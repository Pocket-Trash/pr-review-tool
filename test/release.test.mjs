import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { release } from "../scripts/release.mjs";
import { promoteRelease } from "../scripts/promote-release.mjs";

const latest = "a".repeat(40),
  old = "b".repeat(40);
const repository = "Pocket-Trash/pr-review-tool";
const env = {
  GITHUB_REPOSITORY: repository,
  GITHUB_REF: "refs/heads/main",
  GITHUB_WORKFLOW_REF: `${repository}/.github/workflows/promote-release.yml@refs/heads/main`,
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_ACTOR: "maintainer",
  GITHUB_TRIGGERING_ACTOR: "maintainer",
  GITHUB_TOKEN: "synthetic-test-token",
};

function scenario(overrides = {}) {
  const calls = [],
    summaries = [];
  const selected = overrides.sha || latest;
  const fetch = async (url, options) => {
    const path = url.replace(`https://api.github.com/repos/${repository}`, "");
    calls.push({
      path,
      method: options.method,
      body: options.body && JSON.parse(options.body),
    });
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.authorization, `Bearer ${env.GITHUB_TOKEN}`);
    let result;
    if (path.startsWith("/collaborators/"))
      result = overrides.access || {
        permission: overrides.permission || "write",
        user: { permissions: { maintain: !overrides.permission } },
      };
    else if (path === "/git/ref/heads/main")
      result = { object: { sha: latest } };
    else if (path.startsWith("/compare/"))
      result = {
        status: overrides.ancestry || "ahead",
        merge_base_commit: { sha: selected },
      };
    else if (path.startsWith("/actions/workflows/test.yml/runs?"))
      result = {
        workflow_runs: overrides.runs || [
          {
            id: 123,
            head_sha: selected,
            head_branch: "main",
            event: "push",
            path: ".github/workflows/test.yml",
            status: "completed",
            conclusion: overrides.conclusion || "success",
          },
        ],
      };
    else if (path === "/git/ref/tags/current-release") {
      if (overrides.missing)
        return new Response(null, { status: overrides.lookupStatus || 404 });
      result = {
        object: {
          sha: overrides.previous || old,
          type: overrides.tagType || "commit",
        },
      };
    } else if (path === "/git/ref/heads/current-release") {
      return overrides.branch
        ? Response.json({ object: { sha: old } })
        : new Response(null, { status: 404 });
    } else if (options.method === "PATCH" || options.method === "POST") {
      return overrides.writeFailure
        ? new Response(null, { status: 403 })
        : Response.json({ object: { sha: selected } });
    } else throw new Error(`Unexpected request: ${path}`);
    return Response.json(result);
  };
  return {
    calls,
    summaries,
    options: {
      env: {
        ...env,
        ...(overrides.sha ? { RELEASE_SHA: overrides.sha } : {}),
        ...overrides.env,
      },
      fetch,
      summary: async (text) => summaries.push(text),
    },
  };
}

test("promotion resolves main once, validates exact CI and creates the initial lightweight tag", async () => {
  const mock = scenario({ missing: true });
  await promoteRelease(mock.options);
  assert.equal(
    mock.calls.filter((call) => call.path === "/git/ref/heads/main").length,
    1,
  );
  assert.ok(
    mock.calls.some((call) => call.path.includes(`head_sha=${latest}`)),
  );
  assert.deepEqual(
    mock.calls.filter((call) => call.method !== "GET"),
    [
      {
        path: "/git/refs",
        method: "POST",
        body: { ref: "refs/tags/current-release", sha: latest },
      },
    ],
  );
  assert.match(mock.summaries[0], /none \(initial release\)/);
  assert.match(mock.summaries[0], /Actor: maintainer/);
  assert.match(mock.summaries[0], /Outcome: promoted/);
});

test("promotion updates the tag and allows an explicitly selected rollback without executing target code", async () => {
  for (const input of [{}, { sha: old, previous: latest }]) {
    const mock = scenario(input);
    await promoteRelease(mock.options);
    assert.deepEqual(mock.calls.at(-1), {
      path: "/git/refs/tags/current-release",
      method: "PATCH",
      body: { sha: input.sha || latest, force: true },
    });
    assert.match(
      mock.summaries[0],
      new RegExp(`Previous SHA: ${input.previous || old}`),
    );
    assert.match(
      mock.summaries[0],
      /CI: https:\/\/github.com\/Pocket-Trash\/pr-review-tool\/actions\/runs\/123/,
    );
  }
});

test("an already-current tag is a validated, audited no-op", async () => {
  const mock = scenario({ previous: latest });
  await promoteRelease(mock.options);
  assert.ok(mock.calls.every((call) => call.method === "GET"));
  assert.match(mock.summaries[0], /no-op \(already current\)/);
});

test("untrusted invocations, actors, targets, CI and tag lookups cannot mutate the channel", async () => {
  for (const input of [
    { env: { GITHUB_REF: "refs/heads/feature" } },
    { env: { GITHUB_EVENT_NAME: "push" } },
    { env: { GITHUB_REPOSITORY: "other/repo" } },
    { env: { GITHUB_WORKFLOW_REF: "untrusted" } },
    { env: { GITHUB_TOKEN: "" } },
    { env: { GITHUB_TRIGGERING_ACTOR: "" } },
    { permission: "write" },
    { access: { permission: "read", role_name: "admin" } },
    { sha: "main" },
    { ancestry: "diverged" },
    { conclusion: "failure" },
    { runs: [] },
    {
      runs: [
        {
          id: 123,
          head_sha: latest,
          head_branch: "feature",
          event: "push",
          path: ".github/workflows/test.yml",
          status: "completed",
          conclusion: "success",
        },
      ],
    },
    { missing: true, lookupStatus: 403 },
    { branch: true },
    { tagType: "tag" },
  ]) {
    const mock = scenario(input);
    await assert.rejects(promoteRelease(mock.options));
    assert.ok(
      mock.calls.every((call) => call.method === "GET"),
      JSON.stringify(input),
    );
    assert.match(mock.summaries[0], /Outcome: failed/);
    assert.doesNotMatch(mock.summaries[0], /synthetic-test-token/);
  }
});

test("effective admin and maintain grants are accepted without trusting custom role names", async () => {
  for (const access of [
    { permission: "admin", role_name: "custom-admin-role" },
    {
      permission: "write",
      role_name: "custom-maintainer-role",
      user: { permissions: { maintain: true } },
    },
  ]) {
    const mock = scenario({ access });
    await promoteRelease(mock.options);
    assert.match(mock.summaries[0], /Outcome: promoted/);
  }
});

test("a newer pending or failed CI run cannot fall back to an older success", async () => {
  const base = {
    head_sha: latest,
    head_branch: "main",
    event: "push",
    path: ".github/workflows/test.yml",
  };
  for (const conclusion of ["failure", null]) {
    const mock = scenario({
      runs: [
        { ...base, id: 123, status: "completed", conclusion: "success" },
        {
          ...base,
          id: 124,
          status: conclusion ? "completed" : "in_progress",
          conclusion,
        },
      ],
    });
    await assert.rejects(promoteRelease(mock.options), /passing main Test/);
    assert.ok(mock.calls.every((call) => call.method === "GET"));
  }
});

test("API write failures are audited and never retried automatically", async () => {
  const mock = scenario({ writeFailure: true });
  await assert.rejects(promoteRelease(mock.options), /HTTP 403/);
  assert.equal(mock.calls.filter((call) => call.method !== "GET").length, 1);
  assert.match(mock.summaries[0], /Outcome: failed/);
});

test("pnpm release dispatches trusted main once, follows the returned run and prints audit links", () => {
  for (const args of [
    [],
    ["--sha", old],
    ["--", "--sha", latest.toUpperCase()],
  ]) {
    const calls = [],
      messages = [];
    release(args, {
      write: (message) => messages.push(message),
      runGh: (command, options) => {
        calls.push({ command, options });
        return JSON.stringify({ workflow_run_id: 123 });
      },
    });
    assert.ok(
      calls[0].command.includes(
        `/repos/${repository}/actions/workflows/promote-release.yml/dispatches`,
      ),
    );
    assert.deepEqual(JSON.parse(calls[0].options.input), {
      ref: "main",
      inputs: { sha: args.length ? args.at(-1).toLowerCase() : "" },
    });
    assert.deepEqual(calls[1].command, [
      "run",
      "watch",
      "123",
      "--repo",
      repository,
      "--exit-status",
    ]);
    assert.match(messages.at(-1), /actions\/runs\/123#summary/);
  }
});

test("release CLI rejects invalid arguments before dispatch and never retries an uncertain dispatch", () => {
  for (const args of [
    ["--sha"],
    ["--sha", "main"],
    ["oops"],
    ["--sha", old, "extra"],
  ])
    assert.throws(
      () => release(args, { runGh: () => assert.fail("must not dispatch") }),
      /Usage:/,
    );
  let calls = 0;
  assert.throws(
    () =>
      release([], {
        runGh: () => {
          calls++;
          return "{}";
        },
      }),
    /before retrying/,
  );
  assert.equal(calls, 1);
  assert.throws(
    () =>
      release([], {
        write: () => {},
        runGh: (args) => {
          if (args[0] === "api")
            return JSON.stringify({ workflow_run_id: 123 });
          throw new Error("watch failed");
        },
      }),
    /watch failed/,
  );
});

test("promotion is manual, serialized, main-only and has no model or App credentials", async () => {
  const yaml = await readFile(
    new URL("../.github/workflows/promote-release.yml", import.meta.url),
    "utf8",
  );
  assert.match(yaml, /workflow_dispatch:/);
  assert.doesNotMatch(
    yaml,
    /pull_request:|push:|OPENROUTER|APP_PRIVATE_KEY|Infisical/,
  );
  assert.match(yaml, /cancel-in-progress: false/);
  assert.match(yaml, /github.ref == 'refs\/heads\/main'/);
  assert.match(yaml, /persist-credentials: false/);
  assert.match(yaml, /actions: read/);
  assert.match(yaml, /contents: write/);
  assert.match(yaml, /RELEASE_SHA: \$\{\{ inputs.sha \}\}/);
});
