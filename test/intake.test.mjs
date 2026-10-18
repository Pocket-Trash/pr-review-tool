import assert from "node:assert/strict";
import test from "node:test";
import { buildArtifact, collectInternalReviewContext } from "../src/intake.mjs";

const identity = {
  shouldRun: true,
  repository: "Pocket-Trash/example",
  pullNumber: 42,
  baseSha: "base-sha",
  headSha: "head-sha",
  fork: false,
};

test("intake reads trusted config at the frozen base SHA and patches through GitHub APIs", async () => {
  const requests = [];
  const config = {
    provider: "cheaperinference",
    model: "fixture-model",
    generatedFiles: [],
    limits: {
      maxFiles: 100,
      maxBytes: 1048576,
      maxChangedLines: 20000,
      maxFileBytes: 524288,
    },
  };
  const fetch = async (url) => {
    requests.push(url);
    const body = url.includes("/contents/")
      ? {
          content: Buffer.from(JSON.stringify(config)).toString("base64"),
          encoding: "base64",
        }
      : url.includes("/pulls/42")
        ? {
            title: "Example",
            body: "Description",
            user: { login: "author" },
            base: { sha: "base-sha" },
            head: { sha: "head-sha" },
          }
        : {
            files: [
              {
                filename: "src/example.mjs",
                status: "modified",
                additions: 2,
                deletions: 1,
                patch: "@@ -1 +1,2 @@",
              },
            ],
          };
    return { ok: true, json: async () => body };
  };

  const context = await collectInternalReviewContext(
    identity,
    ".github/pr-review.json",
    "token",
    fetch,
  );
  assert.deepEqual(context.config, config);
  assert.equal(context.files[0].filename, "src/example.mjs");
  assert.deepEqual(context.pull, {
    title: "Example",
    body: "Description",
    author: "author",
  });
  assert.match(
    requests[0],
    /contents\/\.github%2Fpr-review\.json\?ref=base-sha$/,
  );
  assert.match(requests[1], /pulls\/42$/);
  assert.match(requests[2], /compare\/base-sha\.\.\.head-sha$/);
});

test("internal intake refuses fork events", async () => {
  await assert.rejects(
    collectInternalReviewContext(
      { ...identity, fork: true },
      "config.json",
      "token",
      async () => assert.fail(),
    ),
    /internal pull requests/,
  );
});

test("sanitized artifact excludes source and diff content and enforces one MiB", () => {
  const artifact = buildArtifact({
    review: { overview: "ok" },
    run: { runId: "1" },
    selectedSkills: ["review-coordinator"],
    omissions: [],
    diagnostics: [],
  });
  assert.doesNotMatch(artifact, /patch|source/i);
  assert.throws(
    () =>
      buildArtifact({
        review: { overview: "x".repeat(1048576) },
        run: {},
        selectedSkills: [],
        omissions: [],
        diagnostics: [],
      }),
    /1 MiB/,
  );
});
