import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const fixture = async (name) =>
  JSON.parse(
    await readFile(new URL(`fixtures/${name}`, import.meta.url), "utf8"),
  );

test("dispatcher rejects review commands before API calls or visual cancellation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "visual-authorize-"));
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
    const result = spawnSync(process.execPath, ["src/preflight.mjs"], {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        REVIEW_TASK: "visuals",
        REVIEW_AUTHORIZE_ONLY: "true",
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_OUTPUT: outputPath,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(await readFile(outputPath, "utf8"), "runnable=false\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("preflight rejects a trusted review config in the visual workflow before model credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "visual-config-gate-"));
  try {
    const eventPath = join(directory, "event.json");
    await writeFile(
      eventPath,
      JSON.stringify(await fixture("events/pull-request-opened.json")),
    );
    const config = await fixture("config.valid.json");
    const bootstrap = `globalThis.fetch = async (url) => ({ ok: true, json: async () => url.includes('/comments?') ? [] : url.includes('/contents/') ? { encoding: 'base64', content: Buffer.from(${JSON.stringify(JSON.stringify(config))}).toString('base64') } : url.includes('/pulls/') ? { base: { sha: 'base-sha' }, head: { sha: 'head-sha' } } : { files: [] } });`;
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(bootstrap)}`,
        "src/preflight.mjs",
      ],
      {
        encoding: "utf8",
        env: {
          PATH: process.env.PATH,
          REVIEW_TASK: "visuals",
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_TOKEN: "fixture-token",
          REVIEW_CONFIG_PATH: ".github/pr-review.json",
        },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /configuration task does not match the workflow lane/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("publisher converts malformed/oversized files into bounded visual failures using frozen workflow identity", async () => {
  const directory = await mkdtemp(join(tmpdir(), "visual-publisher-"));
  try {
    const eventPath = join(directory, "event.json");
    const artifactPath = join(directory, "artifact.json");
    const commentPath = join(directory, "comment.json");
    await writeFile(
      eventPath,
      JSON.stringify({
        repository: {
          full_name: "Pocket-Trash/example",
          html_url: "https://github.com/Pocket-Trash/example",
        },
        pull_request: { number: 7, head: { sha: "frozen-head" } },
      }),
    );
    const bootstrap = `
      const { writeFile } = await import('node:fs/promises');
      globalThis.fetch = async (url, options = {}) => {
        let body = {};
        if (url.endsWith('/pulls/7')) body = { head: { sha: 'frozen-head' } };
        else if (url.includes('/check-runs?')) body = { check_runs: [] };
        else if (url.includes('/comments?')) body = [];
        else if (url.endsWith('/check-runs')) body = { id: 11 };
        else if (url.endsWith('/issues/7/comments')) await writeFile(${JSON.stringify(commentPath)}, options.body);
        else if (!url.endsWith('/check-runs/11')) throw new Error('Unexpected publication: ' + url);
        return new Response(JSON.stringify(body));
      };
    `;
    for (const content of [
      "{invalid",
      "x".repeat(1024 * 1024 + 1),
      JSON.stringify({
        task: "review",
        conclusion: "success",
        run: { reviewedSha: "wrong-head" },
      }),
    ]) {
      await writeFile(artifactPath, content);
      const result = spawnSync(
        process.execPath,
        [
          "--import",
          `data:text/javascript,${encodeURIComponent(bootstrap)}`,
          "src/publish-review.mjs",
        ],
        {
          encoding: "utf8",
          env: {
            PATH: process.env.PATH,
            REVIEW_TASK: "visuals",
            GITHUB_EVENT_PATH: eventPath,
            REVIEW_ARTIFACT_PATH: artifactPath,
            GITHUB_APP_TOKEN: "fixture-token",
            GITHUB_AUTHENTICATED_APP_SLUG: "pockettrash",
            GITHUB_RUN_ID: "100",
            GITHUB_RUN_ATTEMPT: "2",
            REVIEW_HEAD_SHA: "frozen-head",
          },
        },
      );
      assert.equal(result.status, 0, result.stderr);
      const { body } = JSON.parse(await readFile(commentPath, "utf8"));
      assert.match(body, /pockettrash:pr-visuals-run 100:2/);
      assert.match(body, /operational \*\*failure\*\*/);
      assert.match(body, /Reviewed SHA: frozen-head/);
      assert.doesNotMatch(
        body,
        /wrong-head|## Findings|fixture-token|\{invalid/,
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("preflight refuses a changed head after admission before trusted config or credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "visual-stale-admission-"));
  try {
    const eventPath = join(directory, "event.json");
    await writeFile(
      eventPath,
      JSON.stringify(await fixture("events/pull-request-opened.json")),
    );
    const bootstrap = `globalThis.fetch=async(url)=>{if(!url.includes('/comments?'))throw new Error('Unexpected config or model request');return new Response('[]');};`;
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(bootstrap)}`,
        "src/preflight.mjs",
      ],
      {
        encoding: "utf8",
        env: {
          PATH: process.env.PATH,
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_TOKEN: "fixture",
          REVIEW_TASK: "visuals",
          REVIEW_ADMITTED_HEAD_SHA: "older-admitted-sha",
        },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /head changed after visual admission/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
