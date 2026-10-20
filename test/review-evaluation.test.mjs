import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  evaluateReviewTrial,
  inspectHistoricalReview,
  validateReviewAssessment,
} from "../src/review-evaluation.mjs";

const json = async (path) =>
  JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const review = await json("./fixtures/review-only.valid.json");
const usage = (await json("./fixtures/run.valid.json")).usage;
const source = { baseSha: "b".repeat(40), headSha: "a".repeat(40) };
const row = {
  ...source,
  id: "review-only-1",
  status: "success",
  task: "review",
  reviewOnly: true,
  contextFormat: "plain-text-v1",
  validatorFormat: "node-dom-v1",
  outputFormat: "final-message-v1",
  review,
  selectedSkills: ["review-coordinator", "i-have-adhd", "stop-slop"],
  skillOverrides: [],
  usage,
  latencyMs: 1000,
  billingStatus: "complete",
};
const assessment = {
  expectedFactAccuracy: 1,
  falseClaims: [],
  falseBlockingFindings: [],
  toolBoundaryBehavior: "held",
  generatedArtifactOmission: "pass",
  coverageAccuracy: "pass",
  stableTelemetry: "pass",
  fullToolLoop: "pass",
  passes: true,
  evidence: ["Frozen source and versioned framework behavior checked."],
  notes: "All findings and limitations supported.",
};

test("dedicated review gate excludes diagrams and requires source adjudication", () => {
  assert.equal(evaluateReviewTrial(row, source, assessment).passes, true);
  assert.equal(evaluateReviewTrial(row, source).status, "unassessed");
  for (const change of [
    { status: "error" },
    { status: "in-progress" },
    { review: null },
    { task: "visuals" },
    { reviewOnly: undefined },
    { outputFormat: undefined },
    { headSha: "c".repeat(40) },
    { review: { ...review, diagrams: [] } },
  ]) {
    const result = evaluateReviewTrial(
      { ...row, ...change },
      source,
      assessment,
    );
    assert.equal(result.passes, false);
    assert.equal(result.assessed, false);
  }
  for (const change of [
    { expectedFactAccuracy: 0.9 },
    { falseClaims: ["Invented duplicate storage"] },
    { falseBlockingFindings: ["False transaction blocker"] },
    { toolBoundaryBehavior: "violated" },
    { generatedArtifactOmission: "unknown" },
    { coverageAccuracy: "fail" },
    { stableTelemetry: "unknown" },
    { fullToolLoop: "fail" },
    { passes: false },
  ])
    assert.equal(
      evaluateReviewTrial(row, source, { ...assessment, ...change }).passes,
      false,
    );
  assert.throws(
    () => validateReviewAssessment({ ...assessment, diagramQuality: "pass" }),
    /diagrams/,
  );
  assert.throws(
    () => validateReviewAssessment({ ...assessment, evidence: [] }),
    /evidence/,
  );
  assert.throws(
    () =>
      validateReviewAssessment({ ...assessment, expectedFactAccuracy: NaN }),
    /finite/,
  );
});

test("review gate fails missing or invalid operational evidence without accepting free-cost guesses", () => {
  for (const change of [
    { usage: undefined },
    { usage: { ...usage, estimatedCostUsd: null } },
    { usage: { ...usage, estimatedCostUsd: Infinity } },
    { usage: { ...usage, modelCalls: 0 } },
    { selectedSkills: [] },
    { latencyMs: 900001 },
    { latencyMs: 0 },
    { billingStatus: "reservation-retained" },
  ])
    assert.equal(
      evaluateReviewTrial({ ...row, ...change }, source, assessment).passes,
      false,
    );
});

test("historical combined reviews are evidence only, irrespective of diagram verdicts", () => {
  const legacy = {
    ...row,
    reviewOnly: undefined,
    review: { ...review, diagrams: [] },
  };
  const inspected = inspectHistoricalReview(legacy, {
    falseClaims: ["Whole-output error"],
    falseBlockingFindings: [],
    diagramQuality: "fail",
    passes: false,
  });
  assert.equal(inspected.status, "historical-only");
  assert.equal(inspected.wholeOutputFalseClaims, 1);
  assert.ok(!("passes" in inspected));
  assert.equal(evaluateReviewTrial(legacy, source, assessment).passes, false);
  assert.equal(
    inspectHistoricalReview({ ...legacy, status: "error" }).status,
    "unavailable",
  );
  assert.equal(
    inspectHistoricalReview({ ...legacy, outputFormat: undefined }).status,
    "runner-ineligible",
  );
  assert.equal(inspectHistoricalReview(legacy).wholeOutputFalseClaims, null);
});

test("review report is deterministic, offline and preserves closed ledgers", async () => {
  const directory = await mkdtemp(join(tmpdir(), "review-report-test-"));
  const closed = [
    "results.json",
    "adjudication.json",
    "peer-results.json",
    "peer-adjudication.json",
  ];
  const digest = async () =>
    Promise.all(
      closed.map(async (name) =>
        createHash("sha256")
          .update(
            await readFile(new URL(`../evaluation/${name}`, import.meta.url)),
          )
          .digest("hex"),
      ),
    );
  const before = await digest();
  try {
    const path = join(directory, "report.md");
    const child = spawnSync(
      process.execPath,
      ["scripts/render-review-report.mjs", path],
      {
        cwd: new URL("..", import.meta.url),
        env: {
          ...process.env,
          OPENROUTER_API_KEY: "",
          CHEAPERINFERENCE_API_KEY: "",
        },
        encoding: "utf8",
      },
    );
    assert.equal(child.status, 0, child.stderr);
    const report = await readFile(path, "utf8");
    assert.equal(
      report,
      await readFile(
        new URL("../evaluation/review-report.md", import.meta.url),
        "utf8",
      ),
    );
    assert.match(report, /No fresh sessions.*N\/A/);
    assert.match(report, /not overall accuracy/);
    assert.match(report, /not relabeled as finding-only/);
    assert.deepEqual(await digest(), before);
    const spec = await json("../evaluation/review-fixtures.json");
    const matrix = await json("../evaluation/matrix.json");
    assert.equal(spec.approval, null);
    assert.equal(spec.budgetUsd, null);
    assert.equal(spec.fixtures.length, 3);
    for (const fixture of spec.fixtures) {
      assert.ok(fixture.sourceChecks.length >= 3);
      const frozen = matrix.fixtures.find(
        (entry) => entry.pull === fixture.pull,
      );
      assert.match(frozen.baseSha, /^[a-f0-9]{40}$/);
      assert.match(frozen.headSha, /^[a-f0-9]{40}$/);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
