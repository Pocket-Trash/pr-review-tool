import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  accountedRunCost,
  adjudicationPasses,
  priceUsage,
  validateAdjudication,
  writeJsonAtomic,
} from "../src/evaluation.mjs";

const matrix = JSON.parse(
  await readFile(new URL("../evaluation/matrix.json", import.meta.url), "utf8"),
);

test("evaluation matrix is the fixed bounded 54-run provider/model/fixture set", () => {
  assert.equal(matrix.repetitions, 3);
  assert.equal(matrix.maxRuns, 54);
  assert.equal(matrix.budgetUsd, 10);
  assert.deepEqual(matrix.context.generatedFiles, [
    "pnpm-lock.yaml",
    "**/drizzle/meta/**",
    "**/drizzle/**/snapshot.json",
  ]);
  assert.deepEqual(matrix.context.limits, {
    maxFiles: 100,
    maxBytes: 1_048_576,
    maxChangedLines: 20_000,
    maxFileBytes: 524_288,
  });
  assert.equal(
    matrix.candidates.length * matrix.fixtures.length * matrix.repetitions,
    54,
  );
  assert.deepEqual(
    matrix.fixtures.map(({ pull }) => pull),
    [403, 354, 376],
  );
  assert.ok(
    matrix.fixtures.every(
      ({ baseSha, headSha }) =>
        /^[0-9a-f]{40}$/.test(baseSha) && /^[0-9a-f]{40}$/.test(headSha),
    ),
  );
  assert.deepEqual(
    matrix.candidates.map(({ provider, model }) => `${provider}:${model}`),
    [
      "cheaperinference:deepseek-v4.1-flash",
      "cheaperinference:gemini-3.8-flash",
      "cheaperinference:claude-sonnet-5.5",
      "openrouter:deepseek/deepseek-v4.1-flash",
      "openrouter:google/gemini-3.8-flash",
      "openrouter:anthropic/claude-sonnet-5.5",
    ],
  );
});

test("every worst-case CheaperInference run remains below the fixed budget", () => {
  for (const candidate of matrix.candidates.filter(
    ({ provider }) => provider === "cheaperinference",
  )) {
    const projected =
      (100_000 * candidate.inputPerMillionUsd +
        5_000 * candidate.outputPerMillionUsd) /
      1_000_000;
    assert.ok(projected < matrix.budgetUsd);
  }
});

test("failed inference accounts for the larger of derived usage and reservation", () => {
  const candidate = {
    inputPerMillionUsd: 1,
    outputPerMillionUsd: 2,
  };
  const usage = priceUsage(
    { inputTokens: 10_000, outputTokens: 1_000, estimatedCostUsd: 0 },
    candidate,
  );
  assert.equal(usage.estimatedCostUsd, 0.012);
  assert.equal(
    accountedRunCost({ usage, reservedCostUsd: 0.02, status: "error" }),
    0.02,
  );
  assert.equal(
    accountedRunCost({ usage, reservedCostUsd: 0.005, status: "error" }),
    0.012,
  );
});

test("adjudication requires every exact field and all quality gates", () => {
  assert.throws(
    () => validateAdjudication({ passes: true }),
    /every required field/,
  );
  const passing = {
    expectedFactAccuracy: 1,
    falseClaims: [],
    falseBlockingFindings: [],
    toolBoundaryBehavior: "held",
    generatedArtifactOmission: "pass",
    coverageAccuracy: "pass",
    diagramQuality: "pass",
    stableTelemetry: "pass",
    fullToolLoop: "pass",
    passes: true,
    notes: "Verified against the frozen fixture.",
  };
  assert.equal(adjudicationPasses(passing), true);
  assert.equal(
    adjudicationPasses({ ...passing, falseClaims: ["unsupported claim"] }),
    false,
  );
});

test("atomic evaluation checkpoints preserve the prior ledger on serialization failure", async () => {
  const directory = await mkdtemp(join(tmpdir(), "evaluation-ledger-test-"));
  const path = join(directory, "results.json");
  try {
    await writeFile(path, '{"runs":["prior"]}\n');
    const circular = {};
    circular.self = circular;
    await assert.rejects(writeJsonAtomic(path, circular), /circular/i);
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), {
      runs: ["prior"],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
