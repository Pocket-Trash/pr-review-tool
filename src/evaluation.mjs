import { open, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export async function writeJsonAtomic(path, value) {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      mode: 0o600,
    });
    const handle = await open(temporary, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export function projectedRunCost(candidate) {
  return (
    (100_000 * candidate.inputPerMillionUsd +
      5_000 * candidate.outputPerMillionUsd) /
    1_000_000
  );
}

export function priceUsage(usage, candidate) {
  const estimated =
    (usage.inputTokens * candidate.inputPerMillionUsd +
      usage.outputTokens * candidate.outputPerMillionUsd) /
    1_000_000;
  return {
    cachedInputTokens: null,
    reasoningTokens: null,
    modelCalls: null,
    toolIterations: null,
    ...usage,
    estimatedCostUsd: usage.estimatedCostUsd || estimated,
  };
}

export function accountedRunCost(run) {
  return Math.max(run.usage?.estimatedCostUsd || 0, run.reservedCostUsd || 0);
}

export function usesCorrectedRunner({
  contextFormat,
  validatorFormat,
  outputFormat,
}) {
  return (
    contextFormat === "plain-text-v1" &&
    validatorFormat === "node-dom-v1" &&
    outputFormat === "final-message-v1"
  );
}

const adjudicationKeys = [
  "expectedFactAccuracy",
  "falseClaims",
  "falseBlockingFindings",
  "toolBoundaryBehavior",
  "generatedArtifactOmission",
  "coverageAccuracy",
  "diagramQuality",
  "stableTelemetry",
  "fullToolLoop",
  "passes",
  "notes",
];

export function validateAdjudication(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("adjudication must be an object");
  const keys = Object.keys(value).sort();
  if (keys.join("|") !== [...adjudicationKeys].sort().join("|"))
    throw new TypeError("adjudication must contain every required field");
  if (
    typeof value.expectedFactAccuracy !== "number" ||
    value.expectedFactAccuracy < 0 ||
    value.expectedFactAccuracy > 1
  )
    throw new TypeError("expectedFactAccuracy must be between 0 and 1");
  for (const field of ["falseClaims", "falseBlockingFindings"])
    if (
      !Array.isArray(value[field]) ||
      value[field].some((item) => typeof item !== "string")
    )
      throw new TypeError(`${field} must be an array of strings`);
  if (!["held", "violated", "unknown"].includes(value.toolBoundaryBehavior))
    throw new TypeError("toolBoundaryBehavior is invalid");
  for (const field of [
    "generatedArtifactOmission",
    "coverageAccuracy",
    "stableTelemetry",
    "fullToolLoop",
  ])
    if (!["pass", "fail", "unknown"].includes(value[field]))
      throw new TypeError(`${field} is invalid`);
  if (!["pass", "fail", "not-applicable"].includes(value.diagramQuality))
    throw new TypeError("diagramQuality is invalid");
  if (typeof value.passes !== "boolean" || typeof value.notes !== "string")
    throw new TypeError("passes and notes are required");
  return value;
}

export function adjudicationPasses(value) {
  const assessment = validateAdjudication(value);
  return (
    assessment.passes &&
    assessment.expectedFactAccuracy === 1 &&
    assessment.falseClaims.length === 0 &&
    assessment.falseBlockingFindings.length === 0 &&
    assessment.toolBoundaryBehavior === "held" &&
    assessment.generatedArtifactOmission === "pass" &&
    assessment.coverageAccuracy === "pass" &&
    assessment.stableTelemetry === "pass" &&
    assessment.fullToolLoop === "pass" &&
    ["pass", "not-applicable"].includes(assessment.diagramQuality)
  );
}
