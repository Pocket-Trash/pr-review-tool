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
  renderVisualReliabilityReport,
} from "../src/visual-evaluation.mjs";
import { VISUAL_RELIABILITY_FORMATS } from "../src/visual-validation.mjs";
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

test("reliability campaign has its own $15 approval and refuses mismatched authorization offline", async () => {
  const spec = await json("../evaluation/visual-reliability-spec.json");
  assert.equal(spec.budgetUsd, 15);
  assert.equal(spec.repetitions, 3);
  assert.equal(spec.maxSessions, 27);
  assert.equal(spec.maxRequests, 432);
  assert.ok(spec.estimatedUsd <= 15);
  assert.equal(spec.repairVisuals, true);
  const child = spawnSync(
    process.execPath,
    ["scripts/evaluate-visuals.mjs", "--reliability"],
    {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        OPENROUTER_API_KEY: "not-a-real-key",
        EVALUATION_BUDGET_USD: "5.08",
      },
    },
  );
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /Explicit new \$15 visual-only approval/);
});

test("reliability gates require current host evidence and complete invocation telemetry", async () => {
  const valid = {
    ...row,
    pipelineFormats: VISUAL_RELIABILITY_FORMATS,
    evidence: { version: "frozen-evidence-v1" },
    visualValidation: {
      version: "visual-validation-v1",
      relationshipCatalog: {
        version: "visual-relationships-v1",
        sha256: "c".repeat(64),
      },
      attempts: [{ attempt: 0, missing: [] }],
    },
    invocations: 1,
    usageReports: 1,
  };
  assert.equal(
    (
      await evaluateVisualTrial(
        valid,
        { ...requirements, reliability: true },
        assessment,
      )
    ).passes,
    true,
  );
  for (const change of [
    { pipelineFormats: undefined },
    { evidence: undefined },
    { visualValidation: undefined },
    { invocations: undefined, usageReports: undefined },
    { invocations: 2, usageReports: 1 },
  ])
    assert.equal(
      (
        await evaluateVisualTrial(
          { ...valid, ...change },
          { ...requirements, reliability: true },
          assessment,
        )
      ).status,
      "ineligible",
    );
});

test("reliability report separates unassessed structured output, repairs, budget limits and unstarted slots", async () => {
  const base = await json("../evaluation/visual-fixtures.json");
  const spec = {
    ...base,
    ...(await json("../evaluation/visual-reliability-spec.json")),
  };
  const models = [{ id: "anthropic/claude-sonnet-5.5" }];
  const sessions = [
    {
      ...row,
      id: "complete",
      model: models[0].id,
      pull: 403,
      visualValidation: { attempts: [{}, {}] },
    },
    { id: "limited", model: models[0].id, pull: 403, status: "budget-limited" },
    {
      id: "deferred",
      model: models[0].id,
      pull: 403,
      status: "deferred-unstarted",
    },
  ];
  const requests = [
    { session: "complete", status: "complete", costUsd: 0.1 },
    { session: "limited", status: "complete", costUsd: 0.1 },
  ];
  const fixtures = [
    { pull: 403, baseSha: requirements.baseSha, headSha: requirements.headSha },
  ];
  const report = await renderVisualReliabilityReport(
    { models, sessions, requests },
    spec,
    fixtures,
    { runs: {} },
  );
  assert.match(
    report,
    /complete \| success \| yes \| yes \| unassessed \| no \| N\/A/,
  );
  assert.match(
    report,
    /claude-sonnet-5\.5 \| 1 \/ 9 \| 1 \| 1 \| 0 \| 7 \| 0 \| 1 \| N\/A/,
  );
  assert.match(report, /Source assessment pending; not a visual pass/);
});

test("reliability report is deterministic and offline", async () => {
  const directory = await mkdtemp(join(tmpdir(), "reliability-report-"));
  try {
    const output = join(directory, "report.md");
    const child = spawnSync(
      process.execPath,
      ["scripts/render-visual-reliability-report.mjs", output],
      { encoding: "utf8", env: { PATH: process.env.PATH } },
    );
    assert.equal(child.status, 0, child.stderr);
    assert.equal(
      await readFile(output, "utf8"),
      await readFile(
        new URL("../evaluation/visual-reliability-report.md", import.meta.url),
        "utf8",
      ),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

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

test("recorded visual campaign stays inside its distinct approval and contains no replacement sessions", async () => {
  let ledger;
  try {
    ledger = await json("../evaluation/visual-results.json");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  assert.equal(ledger.campaign, "owner-approved-7.89-visuals-2026-10-20");
  assert.equal(ledger.budgetUsd, 7.89);
  assert.ok(ledger.sessions.length <= 27);
  assert.ok(ledger.requests.length <= 432);
  assert.equal(
    new Set(ledger.sessions.map((row) => row.id)).size,
    ledger.sessions.length,
  );
  let accounted = 0;
  for (const request of ledger.requests) {
    const charge = request.costUsd ?? request.reservedUsd;
    assert.ok(Number.isFinite(charge) && charge >= 0);
    accounted += charge;
    assert.ok(ledger.sessions.some((row) => row.id === request.session));
  }
  assert.ok(accounted <= 7.89);
  for (const row of ledger.sessions) {
    assert.match(
      row.id,
      /^visuals:(anthropic\/claude-sonnet-5\.5|moonshotai\/kimi-k2\.5|z-ai\/glm-5\.3):pr(403|354|376):[123]$/,
    );
    assert.ok(
      ledger.requests.filter((request) => request.session === row.id).length <=
        16,
    );
    assert.equal(row.task, "visuals");
  }
});

test("visual retest requires its separate approval before touching either ledger", async () => {
  const spec = await json("../evaluation/visual-retest-spec.json");
  assert.equal(spec.approval, "owner-approved-5.08-visual-retest-2026-10-20");
  assert.equal(spec.budgetUsd, 5.08);
  assert.equal(spec.maxSessions, 9);
  assert.equal(spec.maxRequests, 144);
  assert.equal(spec.repetitions, 1);
  const child = spawnSync(
    process.execPath,
    ["scripts/evaluate-visuals.mjs", "--retest"],
    {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        OPENROUTER_API_KEY: "not-a-real-key",
        EVALUATION_BUDGET_USD: "7.89",
      },
    },
  );
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /Explicit new \$5\.08 visual-only approval/);
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

test("recorded retest preserves its one-run matrix and cumulative spending cap", async () => {
  let ledger;
  try {
    ledger = await json("../evaluation/visual-retest-results.json");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  assert.equal(ledger.campaign, "owner-approved-5.08-visual-retest-2026-10-20");
  assert.equal(ledger.budgetUsd, 5.08);
  assert.equal(ledger.maxSessions, 9);
  assert.equal(ledger.maxRequests, 144);
  assert.equal(ledger.repetitions, 1);
  assert.ok(ledger.sessions.length <= 9);
  assert.ok(ledger.requests.length <= 144);
  assert.equal(
    new Set(ledger.sessions.map((row) => row.id)).size,
    ledger.sessions.length,
  );
  let accounted = 0;
  for (const request of ledger.requests) {
    const charge = request.costUsd ?? request.reservedUsd;
    assert.ok(Number.isFinite(charge) && charge >= 0);
    accounted += charge;
    assert.ok(ledger.sessions.some((row) => row.id === request.session));
  }
  assert.ok(accounted <= 5.08);
  if (ledger.creditReconciliation) {
    const credit = ledger.creditReconciliation;
    assert.ok(Math.abs(credit.beforeUsd - credit.afterUsd - accounted) < 1e-8);
    assert.ok(Math.abs(credit.returnedBilledUsd - accounted) < 1e-8);
    assert.equal(credit.outstandingReservations, 0);
    assert.ok(
      ledger.requests.every((request) => request.status === "complete"),
    );
  }
  for (const row of ledger.sessions) {
    assert.match(
      row.id,
      /^visuals:(anthropic\/claude-sonnet-5\.5|moonshotai\/kimi-k2\.5|z-ai\/glm-5\.3):pr(403|354|376):1$/,
    );
    assert.ok(
      ledger.requests.filter((request) => request.session === row.id).length <=
        16,
    );
    assert.equal(row.task, "visuals");
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
    "visual-results.json",
    "visual-assessments.json",
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

test("offline retest report stays separate and cannot claim the adoption gate", async () => {
  const directory = await mkdtemp(join(tmpdir(), "visual-retest-report-test-"));
  try {
    const output = join(directory, "retest.md");
    const generated = spawnSync(
      process.execPath,
      ["scripts/render-visual-report.mjs", "--retest", output],
      { encoding: "utf8", env: { PATH: process.env.PATH } },
    );
    assert.equal(generated.status, 0, generated.stderr);
    const text = await readFile(output, "utf8");
    assert.equal(
      text,
      await readFile(
        new URL("../evaluation/visual-retest-report.md", import.meta.url),
        "utf8",
      ),
    );
    assert.match(text, /# Phase 1 source-grounding retest/);
    assert.match(text, /one repetition per model\/fixture/);
    assert.match(text, /\$5\.08 cumulative cap and 9-session \/ 144-request/);
    assert.doesNotMatch(
      text,
      /Candidates meeting all nine dedicated visual trials:/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
