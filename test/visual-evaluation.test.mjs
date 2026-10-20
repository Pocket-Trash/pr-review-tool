import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareReviewContext } from "../src/context.mjs";
import {
  evaluateVisualTrial,
  inspectHistoricalVisuals,
  validateVisualAssessment,
} from "../src/visual-evaluation.mjs";
import { visualRequirements } from "../src/visuals.mjs";

const json = async (path) =>
  JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const result = await json("./fixtures/visuals.valid.json");
const usage = (await json("./fixtures/run.valid.json")).usage;
const requirements = {
  architecture: true,
  schema: "none",
  baseSha: "b".repeat(40),
  headSha: "a".repeat(40),
};
const row = {
  id: "visual-fixture-1",
  baseSha: requirements.baseSha,
  headSha: requirements.headSha,
  selectedSkills: ["i-have-adhd", "stop-slop"],
  skillOverrides: [],
  task: "visuals",
  status: "success",
  contextFormat: "plain-text-v1",
  validatorFormat: "node-dom-v1",
  outputFormat: "final-message-v1",
  review: result,
  latencyMs: 1000,
  usage,
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
  evidence: ["Frozen fixture: retained active queue and staged shared queue."],
  notes: "Descriptive output matches the supplied source.",
};

test("paid visual runner refuses missing campaign approval before touching the ledger", async () => {
  const child = spawnSync(process.execPath, ["scripts/evaluate-visuals.mjs"], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      OPENROUTER_API_KEY: "not-a-real-key",
      EVALUATION_BUDGET_USD: "10",
    },
  });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /Explicit new \$7\.89 visual-only approval/);
});

test("visual fixtures apply generated exclusions before eligibility", async () => {
  const spec = await json("../evaluation/visual-fixtures.json");
  const matrix = await json("../evaluation/matrix.json");
  assert.equal(spec.approval, "owner-approved-7.89-visuals-2026-10-20");
  assert.equal(spec.budgetUsd, 7.89);
  assert.equal(spec.maxSessions, 27);
  assert.equal(spec.maxRequests, 432);
  for (const fixture of spec.fixtures) {
    assert.ok(
      matrix.fixtures.some(
        (entry) =>
          entry.pull === fixture.pull &&
          /^[0-9a-f]{40}$/.test(entry.baseSha) &&
          /^[0-9a-f]{40}$/.test(entry.headSha),
      ),
    );
    const prepared = await prepareReviewContext(
      await json(`./fixtures/pulls/${fixture.pull}.json`),
      matrix.context,
      async () => ({ size: 1, content: "fixture" }),
    );
    assert.equal(prepared.conclusion, "review");
    assert.deepEqual(visualRequirements(prepared.files), {
      architecture: fixture.architecture,
      schema: fixture.schema,
    });
    assert.ok(fixture.sourceChecks.length >= 3);
    assert.ok(
      !prepared.files.some(({ filename }) =>
        filename.endsWith("snapshot.json"),
      ),
    );
  }
});

test("unavailable, runner-invalid, legacy and unassessed results never pass the visual gate", async () => {
  for (const status of ["error", "in-progress", "unavailable"]) {
    const evaluated = await evaluateVisualTrial(
      { ...row, status, review: null },
      requirements,
      assessment,
    );
    assert.equal(evaluated.passes, false);
    assert.equal(evaluated.assessed, false);
  }
  for (const changes of [
    { headSha: "c".repeat(40) },
    { baseSha: undefined },
    { task: "review" },
    { outputFormat: undefined },
    { review: { ...result, findings: [] } },
  ])
    assert.equal(
      (
        await evaluateVisualTrial(
          { ...row, ...changes },
          requirements,
          assessment,
        )
      ).passes,
      false,
    );
  const unassessed = await evaluateVisualTrial(row, requirements);
  assert.equal(unassessed.status, "unassessed");
  assert.equal(unassessed.passes, false);
});

test("visual gate requires semantic, coverage, boundary, runtime and billing proof", async () => {
  assert.equal(
    (await evaluateVisualTrial(row, requirements, assessment)).passes,
    true,
  );
  for (const key of [
    "sourceAccuracy",
    "coverageAccuracy",
    "generatedArtifactOmission",
    "diagramSemantics",
    "stableTelemetry",
    "fullToolLoop",
  ])
    assert.equal(
      (
        await evaluateVisualTrial(row, requirements, {
          ...assessment,
          [key]: "unknown",
        })
      ).passes,
      false,
    );
  for (const changes of [
    { toolBoundaryBehavior: "violated" },
    { falseVisualClaims: ["Unsupported shared-volume edge"] },
  ])
    assert.equal(
      (
        await evaluateVisualTrial(row, requirements, {
          ...assessment,
          ...changes,
        })
      ).passes,
      false,
    );
  for (const changes of [
    { latencyMs: 900001 },
    { latencyMs: 0 },
    { billingStatus: "reservation-retained" },
    { usage: { ...usage, estimatedCostUsd: Infinity } },
    { selectedSkills: ["review-coordinator"] },
    { usage: { ...usage, modelCalls: 0 } },
    { review: { ...result, diagrams: [] } },
  ])
    assert.equal(
      (
        await evaluateVisualTrial(
          { ...row, ...changes },
          requirements,
          assessment,
        )
      ).passes,
      false,
    );
  assert.throws(
    () => validateVisualAssessment({ ...assessment, evidence: [] }),
    /source evidence/,
  );
  assert.throws(
    () =>
      validateVisualAssessment({ ...assessment, falseBlockingFindings: [] }),
    /visual-only field/,
  );
});

test("legacy findings cannot decide diagram evidence or become visual-task passes", async () => {
  const legacy = {
    ...row,
    task: undefined,
    review: { ...result, findings: [] },
  };
  const inspected = await inspectHistoricalVisuals(legacy, requirements, {
    diagramQuality: "pass",
    passes: false,
    falseClaims: ["Review finding error"],
  });
  assert.equal(inspected.status, "historical-only");
  assert.equal(inspected.priorDiagramGate, "pass");
  assert.equal(inspected.syntax, true);
  assert.ok(!("passes" in inspected));
  assert.equal(
    (
      await inspectHistoricalVisuals(
        { ...legacy, outputFormat: undefined },
        requirements,
      )
    ).status,
    "runner-ineligible",
  );
  assert.equal(
    (await inspectHistoricalVisuals({ ...legacy, review: null }, requirements))
      .status,
    "unavailable",
  );
});

test("offline report is deterministic and leaves closed ledgers unchanged", async () => {
  const directory = await mkdtemp(join(tmpdir(), "visual-report-test-"));
  const closed = [
    "results.json",
    "adjudication.json",
    "peer-results.json",
    "peer-adjudication.json",
  ];
  const digests = async () =>
    Promise.all(
      closed.map(async (name) =>
        createHash("sha256")
          .update(
            await readFile(new URL(`../evaluation/${name}`, import.meta.url)),
          )
          .digest("hex"),
      ),
    );
  const before = await digests();
  try {
    const output = join(directory, "report.md");
    for (let attempt = 0; attempt < 2; attempt++) {
      const generated = spawnSync(
        process.execPath,
        ["scripts/render-visual-report.mjs", output],
        { encoding: "utf8", env: { PATH: process.env.PATH } },
      );
      assert.equal(generated.status, 0, generated.stderr);
      const text = await readFile(output, "utf8");
      assert.equal(
        text,
        await readFile(
          new URL("../evaluation/visual-report.md", import.meta.url),
          "utf8",
        ),
      );
      assert.match(
        text,
        /No fresh visual-only inference has run|New visual-only campaign:/,
      );
      assert.match(
        text,
        /approved, not run \| N\/A \| N\/A|Approved cap \$7\.89/,
      );
      assert.match(text, /runner-ineligible/);
      assert.doesNotMatch(
        text,
        /1\.000 accuracy|production winner|selected model:/i,
      );
    }
    assert.deepEqual(await digests(), before);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
