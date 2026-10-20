import {
  adjudicationPasses,
  usesCorrectedRunner,
  validateAdjudication,
} from "./evaluation.mjs";
import { validateCodeReview, validateReview, validateRun } from "./review.mjs";

export function validateReviewAssessment(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("review assessment must be an object");
  const { evidence, ...assessment } = value;
  if ("diagramQuality" in assessment)
    throw new TypeError("review-only assessment must not assess diagrams");
  if (
    !Array.isArray(evidence) ||
    !evidence.length ||
    evidence.some((item) => typeof item !== "string" || !item.trim())
  )
    throw new TypeError("source evidence is required");
  if (!Number.isFinite(assessment.expectedFactAccuracy))
    throw new TypeError("expectedFactAccuracy must be finite");
  validateAdjudication({ ...assessment, diagramQuality: "not-applicable" });
  return value;
}

export function evaluateReviewTrial(row, source, assessment) {
  if (row.status !== "success" || !row.review)
    return { status: "failed", passes: false, assessed: false };
  if (
    row.task !== "review" ||
    row.reviewOnly !== true ||
    !usesCorrectedRunner(row)
  )
    return { status: "ineligible", passes: false, assessed: false };
  if (
    !/^[0-9a-f]{40}$/.test(source.baseSha || "") ||
    !/^[0-9a-f]{40}$/.test(source.headSha || "") ||
    row.baseSha !== source.baseSha ||
    row.headSha !== source.headSha
  )
    return { status: "wrong-source", passes: false, assessed: false };
  try {
    validateCodeReview(row.review);
  } catch {
    return { status: "invalid-contract", passes: false, assessed: false };
  }
  if (!assessment)
    return { status: "unassessed", passes: false, assessed: false };
  validateReviewAssessment(assessment);
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
  const { evidence, ...verdict } = assessment;
  const passes =
    validUsage &&
    adjudicationPasses({ ...verdict, diagramQuality: "not-applicable" }) &&
    Number.isFinite(row.usage?.estimatedCostUsd) &&
    row.usage.modelCalls > 0 &&
    row.selectedSkills.includes("review-coordinator") &&
    Number.isFinite(row.latencyMs) &&
    row.latencyMs > 0 &&
    row.latencyMs <= 15 * 60 * 1000 &&
    row.billingStatus === "complete";
  return { status: passes ? "pass" : "fail", passes, assessed: true };
}

// Combined-task evidence cannot establish a dedicated review-only pass.
export function inspectHistoricalReview(row, assessment) {
  if (row.status !== "success" || !row.review) return { status: "unavailable" };
  if (!usesCorrectedRunner(row)) return { status: "runner-ineligible" };
  try {
    validateReview(row.review);
  } catch {
    return { status: "invalid-contract" };
  }
  return {
    status: "historical-only",
    findingCount: row.review.findings.length,
    wholeOutputFalseClaims: assessment?.falseClaims.length ?? null,
    wholeOutputFalseBlockers: assessment?.falseBlockingFindings.length ?? null,
  };
}
