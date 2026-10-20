import { usesCorrectedRunner } from "./evaluation.mjs";
import {
  validateReview,
  validateVisualAnalysis,
  validateRun,
  validateVisualPhase,
} from "./review.mjs";
import { sanitizeVisuals } from "./visuals.mjs";

const gates = [
  "sourceAccuracy",
  "coverageAccuracy",
  "generatedArtifactOmission",
  "diagramSemantics",
  "stableTelemetry",
  "fullToolLoop",
];

export function validateVisualAssessment(value) {
  const keys = [
    ...gates,
    "toolBoundaryBehavior",
    "falseVisualClaims",
    "evidence",
    "notes",
  ].sort();
  if (!value || Object.keys(value).sort().join() !== keys.join())
    throw new TypeError("visual assessment requires every visual-only field");
  for (const key of gates)
    if (!["pass", "fail", "unknown"].includes(value[key]))
      throw new TypeError(`invalid visual assessment ${key}`);
  if (!["held", "violated", "unknown"].includes(value.toolBoundaryBehavior))
    throw new TypeError("invalid visual tool boundary assessment");
  for (const key of ["falseVisualClaims", "evidence"])
    if (
      !Array.isArray(value[key]) ||
      value[key].some((item) => typeof item !== "string" || !item.trim())
    )
      throw new TypeError(`${key} must contain non-empty strings`);
  if (!value.evidence.length || typeof value.notes !== "string")
    throw new TypeError("source evidence and assessment notes are required");
  return value;
}

async function syntaxPasses(visuals, requirements) {
  const sanitized = await sanitizeVisuals(visuals, requirements);
  return (
    sanitized.diagrams.length === visuals.diagrams.length &&
    sanitized.coverageGaps.length === visuals.coverageGaps.length
  );
}

export async function evaluateVisualTrial(row, requirements, assessment) {
  const visualPhase = validateVisualPhase(requirements.visualPhase);
  if (row.status !== "success" || !row.review)
    return { status: "failed", passes: false, assessed: false };
  if (row.task !== "visuals" || !usesCorrectedRunner(row))
    return { status: "ineligible", passes: false, assessed: false };
  if (visualPhase === 2 && row.visualPhase !== 2)
    return { status: "ineligible", passes: false, assessed: false };
  if (
    !/^[0-9a-f]{40}$/.test(requirements.baseSha || "") ||
    !/^[0-9a-f]{40}$/.test(requirements.headSha || "") ||
    row.baseSha !== requirements.baseSha ||
    row.headSha !== requirements.headSha
  )
    return { status: "wrong-source", passes: false, assessed: false };
  try {
    validateVisualAnalysis(row.review, visualPhase);
  } catch {
    return { status: "invalid-contract", passes: false, assessed: false };
  }
  const syntax = await syntaxPasses(row.review, requirements);
  if (!assessment)
    return { status: "unassessed", syntax, passes: false, assessed: false };
  validateVisualAssessment(assessment);
  let validUsage = true;
  try {
    validateRun({
      reviewedSha: row.headSha,
      runId: row.id,
      selectedSkills: row.selectedSkills,
      skillOverrides: row.skillOverrides,
      usage: row.usage,
    });
  } catch {
    validUsage = false;
  }
  const passes =
    syntax &&
    validUsage &&
    Number.isFinite(row.usage.estimatedCostUsd) &&
    !row.selectedSkills.some((skill) =>
      ["review-coordinator", "ponytail-review"].includes(skill),
    ) &&
    gates.every((key) => assessment[key] === "pass") &&
    assessment.toolBoundaryBehavior === "held" &&
    assessment.falseVisualClaims.length === 0 &&
    Number.isFinite(row.latencyMs) &&
    row.latencyMs > 0 &&
    row.latencyMs <= 15 * 60 * 1000 &&
    row.usage?.modelCalls > 0 &&
    row.billingStatus === "complete";
  return { status: passes ? "pass" : "fail", syntax, passes, assessed: true };
}

// Historical review output is evidence to inspect, never a dedicated visual-task trial.
export async function inspectHistoricalVisuals(
  row,
  requirements,
  priorAssessment,
) {
  if (row.status !== "success" || !row.review) return { status: "unavailable" };
  if (!usesCorrectedRunner(row)) return { status: "runner-ineligible" };
  try {
    validateReview(row.review);
  } catch {
    return { status: "invalid-contract" };
  }
  const { overview, diagrams, changedAreas, coverageGaps } = row.review;
  const visuals = { overview, diagrams, changedAreas, coverageGaps };
  return {
    status: "historical-only",
    syntax: await syntaxPasses(visuals, requirements),
    priorDiagramGate: priorAssessment?.diagramQuality ?? "unassessed",
    diagramCount: diagrams.length,
  };
}
