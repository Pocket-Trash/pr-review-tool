import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateVisualAnalysis, renderReview } from "../src/review.mjs";
import {
  visualRequirements,
  visualPrompt,
  visualSkipReason,
  sanitizeVisuals,
} from "../src/visuals.mjs";
import { runRestrictedReview } from "../src/opencode.mjs";

const fixture = async (name) =>
  JSON.parse(
    await readFile(new URL(`fixtures/${name}`, import.meta.url), "utf8"),
  );
const { files, visuals } = await fixture("state.json");
const run = await fixture("run.valid.json");
const requirements = visualRequirements(files, 2);

test("state eligibility requires explicit Phase 2 source changes, not docs/tests/comments", () => {
  assert.equal(visualRequirements(files).state, undefined);
  assert.match(
    visualPrompt({ architecture: true, schema: "none" }),
    /Use only flowchart and erDiagram/,
  );
  assert.equal(requirements.state, true);
  assert.equal(visualSkipReason(requirements), null);
  for (const file of [
    { ...files[0], filename: "docs/job.ts" },
    { ...files[0], filename: "src/job.test.ts" },
    { filename: "src/job.ts", patch: "+// status = cancelled" },
    { filename: "src/math.ts", patch: "+const n = 1;" },
  ])
    assert.ok(visualSkipReason(visualRequirements([file], 2)));
  assert.match(visualPrompt(requirements), /stateDiagram-v2/);
  assert.match(
    visualPrompt(requirements),
    /source-defined states, transitions and guards/,
  );
  assert.match(
    visualPrompt(requirements),
    /disclose inferred\/unverified transitions/,
  );
});

test("state diagrams use the strict opt-in contract and same renderer/cap", async () => {
  assert.throws(
    () => validateVisualAnalysis(visuals),
    /supported diagram kind/,
  );
  validateVisualAnalysis(visuals, 2);
  const result = await sanitizeVisuals(visuals, requirements);
  assert.deepEqual(result, visuals);
  const config = { ...(await fixture("config.visuals.json")), visualPhase: 2 };
  assert.match(
    renderReview(config, result, run),
    /## PR Visuals[\s\S]*stateDiagram-v2/,
  );
  assert.doesNotMatch(renderReview(config, result, run), /## Findings/);
  const duplicate = await sanitizeVisuals(
    { ...visuals, diagrams: [...visuals.diagrams, ...visuals.diagrams] },
    requirements,
  );
  assert.equal(duplicate.diagrams.length, 1);
  assert.match(duplicate.coverageGaps.join("\n"), /visual-scope limit/);
  assert.equal(
    (await sanitizeVisuals(visuals, visualRequirements(files))).diagrams.length,
    0,
  );
});

test("unsafe, invalid and wrong-type state diagrams become visible omissions", async () => {
  for (const mermaid of [
    "stateDiagram-v2\n Queued -->",
    "flowchart LR\n A-->B",
    "stateDiagram-v2\n Queued --> Done\n click Done https://example.com",
    "%%{init: {}}%%\nstateDiagram-v2\n Queued-->Done",
  ]) {
    const result = await sanitizeVisuals(
      { ...visuals, diagrams: [{ ...visuals.diagrams[0], mermaid }] },
      requirements,
    );
    assert.equal(result.diagrams.length, 0);
    assert.match(
      result.coverageGaps.join("\n"),
      /Omitted|no valid source-grounded state/,
    );
  }
});

test("state runner preserves the read-only visual contract", async () => {
  const result = await runRestrictedReview({
    task: "visuals",
    visualPhase: 2,
    model: "fixture-model",
    apiKey: "fixture-key",
    workspace: new URL("fixtures/workspace", import.meta.url).pathname,
    visualRequirements: requirements,
    execute: async (_command, args, options) => {
      assert.match(args.at(-1), /kind is .*state/);
      assert.equal(
        JSON.parse(options.env.OPENCODE_CONFIG_CONTENT).permission["*"],
        "deny",
      );
      return {
        stdout: JSON.stringify({
          type: "text",
          part: { text: JSON.stringify(visuals) },
        }),
      };
    },
  });
  assert.deepEqual(result, visuals);
});
