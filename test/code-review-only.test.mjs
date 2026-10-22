import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateCodeReview, renderReview } from "../src/review.mjs";
import { runRestrictedReview, usageFromEvents } from "../src/opencode.mjs";
import { artifactByteLimit, buildArtifact } from "../src/intake.mjs";
import {
  preparePublication,
  publishReview,
  COMMENT_MARKER,
  VISUAL_COMMENT_MARKER,
  CHECK_NAME,
  StaleReviewError,
} from "../src/publication.mjs";

const fixture = async (name) =>
  JSON.parse(
    await readFile(new URL(`fixtures/${name}`, import.meta.url), "utf8"),
  );
const config = await fixture("config.review-only.json");
const review = await fixture("review-only.valid.json");
const run = await fixture("run.valid.json");
const artifact = {
  task: "review",
  conclusion: "success",
  config,
  review,
  run: { ...run, runId: "100" },
};
const publicationOptions = {
  task: "review",
  reviewOnly: true,
  runId: "100",
  runAttempt: "1",
  reviewedSha: run.reviewedSha,
};

test("unreported or partial cost is unknown, not a zero-cost claim", () => {
  const step = (cost) => ({
    type: "step_finish",
    part: {
      tokens: { input: 10, output: 2 },
      ...(cost === undefined ? {} : { cost }),
    },
  });
  assert.equal(usageFromEvents([step()]).estimatedCostUsd, null);
  assert.equal(usageFromEvents([step(0.01), step()]).estimatedCostUsd, null);
  assert.equal(usageFromEvents([step(0)]).estimatedCostUsd, 0);
  assert.match(
    renderReview(config, review, {
      ...run,
      usage: { ...run.usage, estimatedCostUsd: null },
    }),
    /Estimated cost: unknown/,
  );
});

test("review-only contract and renderer reject visuals while preserving finding validation", () => {
  assert.equal(validateCodeReview(review), review);
  for (const key of ["diagrams", "status", "metadata"])
    assert.throws(
      () => validateCodeReview({ ...review, [key]: [] }),
      /unknown fields/,
    );
  assert.throws(
    () => validateCodeReview({ ...review, findings: [{ severity: "urgent" }] }),
    /severity/,
  );
  const output = renderReview(config, review, run);
  assert.match(output, /^## PR Review/);
  assert.match(output, /## Findings/);
  assert.match(output, /Run and cost details/);
  assert.doesNotMatch(output, /## Architecture|## Diagrams|mermaid/);
  const result = spawnSync(
    process.execPath,
    [
      "src/fixture.mjs",
      "test/fixtures/config.review-only.json",
      "test/fixtures/review-only.valid.json",
      "test/fixtures/run.valid.json",
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, output);
});

test("review-only inference uses the dedicated contract, denies writes and cannot accept visual results", async () => {
  const options = {
    task: "review",
    reviewOnly: true,
    model: "fixture-model",
    apiKey: "fixture-key",
    workspace: new URL("fixtures/workspace", import.meta.url).pathname,
  };
  const value = await runRestrictedReview({
    ...options,
    skills: [],
    execute: async (_command, args, options) => {
      assert.match(
        args.at(-1),
        /Load review-coordinator, i-have-adhd, stop-slop/,
      );
      assert.match(
        args.at(-1),
        /exactly these four top-level keys: overview, findings, changedAreas, coverageGaps/,
      );
      assert.match(args.at(-1), /The separate visual lane owns diagrams/);
      assert.doesNotMatch(args.at(-1), /Conditional visuals requested/);
      assert.equal(
        JSON.parse(options.env.OPENCODE_CONFIG_CONTENT).permission["*"],
        "deny",
      );
      const coordinator = await readFile(
        join(
          options.env.OPENCODE_CONFIG_DIR,
          "skills/review-coordinator/SKILL.md",
        ),
        "utf8",
      );
      assert.match(coordinator, /caller.s selected result contract/);
      return {
        stdout: JSON.stringify({
          type: "text",
          part: { text: JSON.stringify(review) },
        }),
      };
    },
  });
  assert.deepEqual(value, review);
  await assert.rejects(
    runRestrictedReview({
      ...options,
      execute: async () => ({
        stdout: JSON.stringify({
          type: "text",
          part: { text: JSON.stringify({ ...review, diagrams: [] }) },
        }),
      }),
    }),
    /valid structured review/,
  );
  await assert.rejects(
    runRestrictedReview({ ...options, task: "visuals" }),
    /requires the review task/,
  );
});

test("review-only publication is strict, sanitized and visually independent", async () => {
  const input = structuredClone(artifact);
  input.review.overview = `@owner <script>x</script> ${VISUAL_COMMENT_MARKER}`;
  const output = await preparePublication(input, publicationOptions);
  assert.ok(output.body.startsWith(COMMENT_MARKER));
  assert.match(output.body, /pr-review-run 100:1/);
  assert.match(output.body, /## PR Review/);
  assert.doesNotMatch(
    output.body,
    /<script>|## PR Visuals|## Architecture|## Diagrams/,
  );
  assert.ok(!output.body.includes(VISUAL_COMMENT_MARKER));
  for (const input of [
    { ...artifact, task: "visuals" },
    { ...artifact, task: undefined },
    { ...artifact, config: { ...config, task: undefined } },
    { ...artifact, review: { ...review, diagrams: [] } },
    { ...artifact, run: { ...artifact.run, runId: "99" } },
  ])
    await assert.rejects(
      preparePublication(input, publicationOptions),
      /artifact|configuration|unknown fields/,
    );
  for (const conclusion of ["neutral", "failure", "timed_out", "cancelled"]) {
    const output = await preparePublication(
      { task: "review", conclusion, diagnostics: ["Operational result"] },
      publicationOptions,
    );
    assert.equal(output.conclusion, conclusion);
    assert.match(output.body, /## PR Review[\s\S]*Reviewed SHA:/);
    assert.doesNotMatch(output.body, /## Architecture|## Diagrams/);
  }
});

function mockPublication(previous = "99:1", headSha = run.reviewedSha) {
  const calls = [];
  const response = (body) => new Response(JSON.stringify(body));
  const fetch = async (url, options = {}) => {
    calls.push({
      url,
      method: options.method || "GET",
      body: options.body && JSON.parse(options.body),
    });
    if (url.endsWith("/pulls/7")) return response({ head: { sha: headSha } });
    if (url.includes("/check-runs?")) {
      assert.match(url, /Pocket%20Trash%20PR%20Review/);
      return response({
        check_runs: [
          {
            id: 11,
            external_id: "pockettrash-pr-review:Pocket-Trash/example#7",
            app: { slug: "pockettrash" },
          },
          {
            id: 12,
            external_id: "pockettrash-pr-visuals:Pocket-Trash/example#7",
            app: { slug: "pockettrash" },
          },
        ],
      });
    }
    if (url.includes("/issues/7/comments?"))
      return response([
        {
          id: 21,
          user: { type: "Bot", login: "pockettrash[bot]" },
          body: VISUAL_COMMENT_MARKER,
        },
        {
          id: 22,
          user: { type: "Bot", login: "pockettrash[bot]" },
          body: `${COMMENT_MARKER}\n<!-- pockettrash:pr-review-run ${previous} -->`,
        },
      ]);
    if (url.endsWith("/check-runs/11")) return response({ id: 11 });
    if (url.endsWith("/issues/comments/22")) return response({ id: 22 });
    throw new Error(`unexpected request: ${url}`);
  };
  return { calls, fetch };
}
const publishOptions = {
  task: "review",
  reviewOnly: true,
  runId: "100",
  runAttempt: "2",
  artifact,
  token: "fixture-token",
  repository: "Pocket-Trash/example",
  pullNumber: 7,
  expectedHeadSha: run.reviewedSha,
  authenticatedAppSlug: "pockettrash",
};

test("same-SHA review reruns update only the review comment/check, never visuals", async () => {
  const mock = mockPublication("100:1");
  const result = await publishReview({ ...publishOptions, fetch: mock.fetch });
  assert.equal(result.conclusion, "success");
  const writes = mock.calls.filter(({ method }) => method !== "GET");
  assert.ok(writes.some(({ url }) => url.endsWith("/issues/comments/22")));
  assert.ok(
    !writes.some(({ url }) => /comments\/21$|check-runs\/12$/.test(url)),
  );
  assert.equal(writes.at(-1).body.output.title, `${CHECK_NAME}: success`);
  for (const mock of [
    mockPublication("101:1"),
    mockPublication("100:3"),
    mockPublication("99:1", "newer-head"),
  ]) {
    await assert.rejects(
      publishReview({ ...publishOptions, fetch: mock.fetch }),
      StaleReviewError,
    );
    assert.deepEqual(
      mock.calls.filter(({ method }) => method !== "GET"),
      [],
    );
  }
});

test("review-only failure cannot publish a visual artifact into either visual or review content", async () => {
  const mock = mockPublication();
  const output = await publishReview({
    ...publishOptions,
    artifact: { ...artifact, task: "visuals" },
    fetch: mock.fetch,
  });
  assert.equal(output.conclusion, "failure");
  assert.match(output.body, /## PR Review[\s\S]*artifact validation failed/);
  assert.doesNotMatch(output.body, /The supplied source stages/);
});

test("disabled review workflow authorization/publication cannot call APIs or require credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "review-disabled-"));
  try {
    const eventPath = join(directory, "event.json");
    const outputPath = join(directory, "output");
    await writeFile(
      eventPath,
      JSON.stringify({
        action: "created",
        issue: { number: 7, pull_request: {} },
        comment: { body: "!pockettrash review" },
      }),
    );
    const env = {
      PATH: process.env.PATH,
      GITHUB_EVENT_PATH: eventPath,
      REVIEW_TASK: "review",
      REVIEW_CODE_ENABLED: "false",
      GITHUB_OUTPUT: outputPath,
    };
    const bootstrap =
      "globalThis.fetch = async () => { throw new Error('disabled lane called API'); };";
    for (const script of ["src/preflight.mjs", "src/publish-review.mjs"]) {
      const result = spawnSync(
        process.execPath,
        [
          "--import",
          `data:text/javascript,${encodeURIComponent(bootstrap)}`,
          script,
        ],
        { encoding: "utf8", env },
      );
      assert.equal(result.status, 0, result.stderr);
    }
    assert.equal(await readFile(outputPath, "utf8"), "runnable=false\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("lane allocations preserve one combined MiB artifact ceiling and lane-attributed telemetry", () => {
  const laneLimit = artifactByteLimit({
    REVIEW_ARTIFACT_LIMIT_BYTES: "524288",
  });
  assert.equal(laneLimit * 2, 1024 * 1024);
  for (const value of ["0", "-1", "1048577", "NaN"])
    assert.throws(
      () => artifactByteLimit({ REVIEW_ARTIFACT_LIMIT_BYTES: value }),
      /shared 1 MiB/,
    );
  for (const task of ["review", "visuals"]) {
    const artifact = JSON.parse(buildArtifact({ task, run, diagnostics: [] }));
    assert.equal(artifact.task, task);
    assert.equal(
      artifact.run.usage.estimatedCostUsd,
      run.usage.estimatedCostUsd,
    );
  }
  for (const estimatedCostUsd of [NaN, Infinity])
    assert.throws(
      () =>
        renderReview(config, review, {
          ...run,
          usage: { ...run.usage, estimatedCostUsd },
        }),
      /estimatedCostUsd/,
    );
});

test("enabled review analysis is independent of visual eligibility and skips wholly excluded source", async () => {
  const directory = await mkdtemp(join(tmpdir(), "review-only-automatic-"));
  try {
    const eventPath = join(directory, "event.json");
    const artifactPath = join(directory, "artifact.json");
    await writeFile(
      eventPath,
      JSON.stringify(await fixture("events/pull-request-opened.json")),
    );
    const stdout = [
      {
        type: "step_finish",
        part: { tokens: { input: 30, output: 10 }, cost: 0.001 },
      },
      {
        type: "text",
        part: {
          text: JSON.stringify({
            ...review,
            overview: "Documentation wording changed.",
          }),
        },
      },
    ]
      .map((event) => JSON.stringify(event))
      .join("\n");
    await writeFile(
      join(directory, "npx"),
      `#!/usr/bin/env node\nif(process.argv.at(-1).includes('Conditional visuals requested')) throw new Error('review invoked visuals');\nprocess.stdout.write(${JSON.stringify(stdout)});\n`,
      { mode: 0o755 },
    );
    for (const excluded of [false, true]) {
      const filename = excluded ? "src/generated/api.ts" : "README.md";
      const bootstrap = `
        globalThis.fetch = async (url) => {
          let body;
          if (url.includes('/contents/.github%2Fpr-review.json')) body = { encoding: 'base64', content: Buffer.from(${JSON.stringify(JSON.stringify(config))}).toString('base64') };
          else if (url.includes('/pulls/42')) body = { base: { sha: 'base-sha' }, head: { sha: 'head-sha' } };
          else if (url.includes('/compare/')) body = { files: [{ filename: ${JSON.stringify(filename)}, status: 'modified', additions: 1, deletions: 0, patch: '+documentation' }] };
          else if (url.endsWith('/contents/README.md?ref=head-sha')) body = { encoding: 'base64', size: 12, content: Buffer.from('documentation').toString('base64') };
          else if (url.endsWith('/contents/package.json?ref=head-sha')) return new Response(null, { status: 404 });
          else throw new Error('Unexpected analysis request: ' + url);
          return new Response(JSON.stringify(body));
        };
      `;
      const env = {
        PATH: `${directory}:${process.env.PATH}`,
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_TOKEN: "fixture-token",
        GITHUB_RUN_ID: "100",
        REVIEW_ARTIFACT_PATH: artifactPath,
        REVIEW_CONFIG_PATH: ".github/pr-review.json",
        REVIEW_TASK: "review",
        REVIEW_CODE_ENABLED: "true",
        REVIEW_ARTIFACT_LIMIT_BYTES: "524288",
        ...(excluded ? {} : { CHEAPER_INFERENCE_API_KEY: "fixture-key" }),
      };
      const result = spawnSync(
        process.execPath,
        [
          "--import",
          `data:text/javascript,${encodeURIComponent(bootstrap)}`,
          "src/automatic-review.mjs",
        ],
        { encoding: "utf8", env },
      );
      assert.equal(result.status, 0, result.stderr);
      const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
      assert.equal(artifact.task, "review");
      assert.equal(artifact.conclusion, excluded ? "neutral" : "success");
      assert.equal(artifact.run.usage.modelCalls, excluded ? 0 : 1);
      assert.equal(artifact.run.usage.estimatedCostUsd, excluded ? 0 : 0.001);
      if (excluded)
        assert.match(artifact.diagnostics.join("\n"), /inference was skipped/);
      else assert.ok(!("diagrams" in artifact.review));
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("artifact construction enforces the workflow lane allocation before upload", () => {
  const code = `import assert from 'node:assert/strict'; import {buildArtifact} from './src/intake.mjs'; assert.throws(() => buildArtifact({ task:'review', diagnostics:['x'.repeat(524288)] }), /lane limit/);`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", code],
    {
      encoding: "utf8",
      env: { PATH: process.env.PATH, REVIEW_ARTIFACT_LIMIT_BYTES: "524288" },
    },
  );
  assert.equal(result.status, 0, result.stderr);
});
