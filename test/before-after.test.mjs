import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateVisualAnalysis, renderReview } from "../src/review.mjs";
import {
  visualRequirements,
  visualPrompt,
  visualBaseCandidates,
  sanitizeVisuals,
} from "../src/visuals.mjs";
import { prepareReviewContext } from "../src/context.mjs";
import { loadChangedFile, loadBaseEvidence } from "../src/intake.mjs";
import { evaluateVisualTrial } from "../src/visual-evaluation.mjs";

const fixture = async (name) =>
  JSON.parse(
    await readFile(new URL(`fixtures/${name}`, import.meta.url), "utf8"),
  );
const { files, visuals, unsupported } = await fixture("before-after.json");
const run = await fixture("run.valid.json");
const requirements = visualRequirements(files, 2);

test("before/after eligibility requires changed topology and complete distinct frozen revisions", () => {
  assert.equal(visualRequirements(files).beforeAfter, undefined);
  assert.equal(requirements.beforeAfter, true);
  for (const change of [
    { baseContent: undefined },
    { baseSha: "main" },
    { headSha: files[0].baseSha },
    { content: files[0].baseContent },
    { filename: "docs/infra/queue.json" },
    { filename: "src/plain.json" },
  ])
    assert.equal(
      visualRequirements([{ ...files[0], ...change }], 2).beforeAfter,
      false,
    );
  assert.equal(
    visualRequirements(
      [
        {
          ...files[0],
          content: files[0].baseContent,
          previous_filename: "infra/old.json",
          status: "renamed",
        },
      ],
      2,
    ).beforeAfter,
    true,
  );
  assert.equal(
    visualRequirements(
      [
        {
          ...files[0],
          filename: "src/config.json",
          previous_filename: "infra/queue.json",
          content: files[0].baseContent,
          status: "renamed",
        },
      ],
      2,
    ).beforeAfter,
    true,
  );
  assert.equal(
    visualRequirements([{ ...files[0], status: "added", baseContent: "" }], 2)
      .beforeAfter,
    true,
  );
  assert.equal(
    visualRequirements(
      [{ ...files[0], status: "removed", content: files[0].baseContent }],
      2,
    ).beforeAfter,
    true,
  );
  assert.deepEqual(
    visualBaseCandidates([
      ...files,
      { filename: "package.json" },
      { filename: "docs/infra/queue.json" },
      { filename: "src/job.test.ts" },
    ]).map(({ filename }) => filename),
    ["infra/queue.json", "package.json"],
  );
  assert.match(visualPrompt(requirements), /exact base\/head SHAs/);
  assert.match(
    visualPrompt(requirements),
    /do not treat declaration changes as live deployment state/,
  );
});

test("before/after views use strict Phase 2 flowcharts and the existing visual comment", async () => {
  assert.throws(
    () => validateVisualAnalysis(visuals),
    /supported diagram kind/,
  );
  validateVisualAnalysis(visuals, 2);
  const result = await sanitizeVisuals(visuals, {
    ...requirements,
    architecture: false,
  });
  assert.deepEqual(result, visuals);
  const config = { ...(await fixture("config.visuals.json")), visualPhase: 2 };
  const markdown = renderReview(config, visuals, run);
  assert.match(markdown, /## PR Visuals[\s\S]*Declared queue topology/);
  assert.doesNotMatch(markdown, /## Findings/);
  for (const mermaid of [
    "flowchart LR\n A-->",
    "stateDiagram-v2\n A-->B",
    "flowchart LR\n A-->B\n click A https://example.com",
  ])
    assert.equal(
      (
        await sanitizeVisuals(
          { ...visuals, diagrams: [{ ...visuals.diagrams[0], mermaid }] },
          requirements,
        )
      ).diagrams.length,
      0,
    );
  assert.equal(
    (
      await sanitizeVisuals(
        { ...visuals, diagrams: [...visuals.diagrams, ...visuals.diagrams] },
        requirements,
      )
    ).diagrams.length,
    1,
  );
  assert.equal(
    (await sanitizeVisuals(visuals, visualRequirements(files))).diagrams.length,
    0,
  );
});

test("missing source content is an omission, never an empty-side topology proof", async () => {
  const identity = {
    repository: "Pocket-Trash/example",
    baseSha: files[0].baseSha,
    headSha: files[0].headSha,
  };
  const loaded = await loadChangedFile(
    identity,
    files[0],
    "fixture-token",
    async () => new Response(JSON.stringify({ encoding: "none", size: 10 })),
  );
  assert.equal(loaded.available, false);
  const context = await prepareReviewContext(
    files,
    await fixture("config.visuals.json"),
    async () => loaded,
  );
  assert.deepEqual(context.files, []);
  assert.match(context.omissions.join("\n"), /source content unavailable/);
  assert.equal(visualRequirements(context.files, 2).beforeAfter, false);
});

test("removed file intake reads base rather than inventing a head source", async () => {
  const identity = {
    repository: "Pocket-Trash/example",
    baseSha: files[0].baseSha,
    headSha: files[0].headSha,
  };
  const file = { ...files[0], status: "removed" };
  const loaded = await loadChangedFile(
    identity,
    file,
    "fixture-token",
    async (url) => {
      assert.match(url, new RegExp(`ref=${identity.baseSha}$`));
      return new Response(
        JSON.stringify({
          encoding: "base64",
          size: file.baseContent.length,
          content: Buffer.from(file.baseContent).toString("base64"),
        }),
      );
    },
  );
  const evidence = await loadBaseEvidence(
    identity,
    { ...file, content: loaded.content },
    "fixture-token",
    1024,
    async () => assert.fail("removed file was refetched"),
  );
  assert.equal(evidence.baseContent, file.baseContent);
  assert.equal(
    visualRequirements([{ ...file, ...evidence, content: loaded.content }], 2)
      .beforeAfter,
    true,
  );
});

test("parse-valid before/after views cannot prove a cutover, removed retained paths, or live deployment", async () => {
  const scope = {
    ...requirements,
    architecture: false,
    visualPhase: 2,
    baseSha: files[0].baseSha,
    headSha: files[0].headSha,
  };
  const row = {
    task: "visuals",
    visualPhase: 2,
    status: "success",
    id: "before-after-fixture",
    baseSha: scope.baseSha,
    headSha: scope.headSha,
    contextFormat: "plain-text-v1",
    validatorFormat: "node-dom-v1",
    outputFormat: "final-message-v1",
    review: visuals,
    latencyMs: 1000,
    usage: run.usage,
    selectedSkills: ["i-have-adhd", "stop-slop"],
    skillOverrides: [],
    billingStatus: "complete",
  };
  const assessment = {
    sourceAccuracy: "pass",
    coverageAccuracy: "pass",
    generatedArtifactOmission: "pass",
    diagramSemantics: "pass",
    stableTelemetry: "pass",
    fullToolLoop: "pass",
    toolBoundaryBehavior: "held",
    falseVisualClaims: [],
    evidence: [
      "Both frozen declarations retain legacyRedis.active=true; head adds sharedRedis.staged=true/active=false.",
    ],
    notes: "No live deployment was inspected.",
  };
  assert.equal(
    (await evaluateVisualTrial(row, scope, assessment)).passes,
    true,
  );
  assert.equal((await sanitizeVisuals(unsupported, scope)).diagrams.length, 1);
  assert.equal(
    (
      await evaluateVisualTrial({ ...row, review: unsupported }, scope, {
        ...assessment,
        sourceAccuracy: "fail",
        diagramSemantics: "fail",
        falseVisualClaims: [
          "Shared Redis is staged/inactive; legacy remains; no live cutover evidence exists.",
        ],
      })
    ).passes,
    false,
  );
});
