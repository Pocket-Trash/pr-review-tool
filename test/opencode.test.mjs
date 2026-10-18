import assert from "node:assert/strict";
import test from "node:test";
import { createOpenCodeConfig, runRestrictedReview } from "../src/opencode.mjs";

const review = {
  overview: "Safe review.",
  findings: [],
  diagrams: [],
  changedAreas: [{ area: "Runner", summary: "Adds restricted inference." }],
  coverageGaps: [],
};

test("restricted runner validates successful inference", async () => {
  let invocation;
  const result = await runRestrictedReview({
    apiKey: "secret",
    model: "fixture-model",
    workspace: "/tmp/review-fixture",
    execute: async (command, args, options) => {
      invocation = { command, args, options };
      return {
        stdout: `${JSON.stringify({ type: "text", part: { text: JSON.stringify(review) } })}\n`,
      };
    },
  });

  assert.deepEqual(result, review);
  assert.equal(invocation.command, "npx");
  assert.deepEqual(invocation.args.slice(0, 5), [
    "--yes",
    "opencode-ai@1.19.3",
    "--pure",
    "run",
    "--format",
  ]);
  assert.equal(invocation.options.cwd, "/tmp/review-fixture");
  assert.deepEqual(Object.keys(invocation.options.env).sort(), [
    "CHEAPER_INFERENCE_API_KEY",
    "HOME",
    "NO_COLOR",
    "OPENCODE_CONFIG_CONTENT",
    "OPENCODE_CONFIG_DIR",
    "PATH",
    "TMPDIR",
    "XDG_CONFIG_HOME",
  ]);
});

test("restricted runner rejects malformed model output", async () => {
  await assert.rejects(
    runRestrictedReview({
      apiKey: "secret",
      model: "fixture-model",
      workspace: "/tmp/review-fixture",
      execute: async () => ({
        stdout: `${JSON.stringify({ type: "text", part: { text: "not json" } })}\n`,
      }),
    }),
    /valid structured review/,
  );
});

test("restricted runner rejects a missing credential before execution", async () => {
  await assert.rejects(
    runRestrictedReview({
      model: "fixture-model",
      workspace: "/tmp/review-fixture",
      execute: async () => assert.fail("must not execute"),
    }),
    /CHEAPER_INFERENCE_API_KEY is required/,
  );
});

test("restricted runner reports timeout", async () => {
  const error = Object.assign(new Error("timed out"), { code: "ETIMEDOUT" });
  await assert.rejects(
    runRestrictedReview({
      apiKey: "secret",
      model: "fixture-model",
      workspace: "/tmp/review-fixture",
      execute: async () => Promise.reject(error),
    }),
    /timed out/,
  );
});

test("OpenCode configuration denies every capability except review reads and exact skills", () => {
  const config = createOpenCodeConfig("fixture-model");
  assert.deepEqual(config.permission, {
    "*": "deny",
    read: "allow",
    glob: "allow",
    grep: "allow",
    skill: {
      "review-coordinator": "allow",
      "i-have-adhd": "allow",
      "stop-slop": "allow",
      "*": "deny",
    },
    external_directory: "deny",
  });
  assert.equal(config.lsp, false);
  assert.deepEqual(config.mcp, {});
  assert.deepEqual(Object.keys(config.provider), ["cheaperinference"]);
});
