import { usesCorrectedRunner } from "./evaluation.mjs";
import {
  validateReview,
  validateVisualAnalysis,
  validateRun,
  validateVisualPhase,
} from "./review.mjs";
import { sanitizeVisuals } from "./visuals.mjs";
import { VISUAL_RELIABILITY_FORMATS } from "./visual-validation.mjs";
import { budgetTotal } from "./evaluation-budget.mjs";

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
  if (
    requirements.reliability &&
    (Object.entries(VISUAL_RELIABILITY_FORMATS).some(
      ([key, value]) => row.pipelineFormats?.[key] !== value,
    ) ||
      row.evidence?.version !== VISUAL_RELIABILITY_FORMATS.evidence ||
      row.visualValidation?.version !== "visual-validation-v1" ||
      row.visualValidation?.relationshipCatalog?.version !==
        VISUAL_RELIABILITY_FORMATS.relationships ||
      !/^[0-9a-f]{64}$/.test(
        row.visualValidation?.relationshipCatalog?.sha256 ?? "",
      ) ||
      ![1, 2].includes(row.visualValidation?.attempts?.length) ||
      row.visualValidation.attempts.at(-1).missing?.length !== 0 ||
      !Number.isSafeInteger(row.invocations) ||
      row.invocations < 1 ||
      row.usageReports !== row.invocations)
  )
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

export async function renderVisualReliabilityReport(
  ledger,
  spec,
  fixtures,
  assessments,
) {
  const sessions = ledger?.sessions ?? [];
  const requests = ledger?.requests ?? [];
  const lines = [
    "# Phase 1 visual reliability evaluation",
    "",
    `Campaign: ${spec.approval}. Status: ${ledger?.status ?? "approved, not run"}. Cap: $${spec.budgetUsd}, including paid failures, repairs and retained reservations. ${sessions.length}/${spec.maxSessions} slots recorded; ${requests.length}/${spec.maxRequests} requests. Accounted: $${budgetTotal(requests).toFixed(6)}. No paid replacements.`,
    "",
    `Planning estimate: $${spec.estimatedUsd}. ${spec.estimateMethod}`,
    "",
    "Structured completion is not source accuracy. A visual pass requires source, diagram, coverage, omissions, telemetry, billing and denied-tool assessments. Unassessed/unavailable output is never a zero-defect score. Runner coverage confirms supplied/read ranges, not comprehension. Source-call edges do not prove runtime infrastructure. Each candidate needs all nine frozen trials to pass; route approval and live activation remain separate.",
    "",
    "<!-- prettier-ignore -->",
    "| Session | Execution | Structured | Repaired | Source / diagram / coverage | Assessed | Visual pass |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  const evaluated = [];
  for (const row of sessions) {
    const fixture = fixtures.find((f) => f.pull === row.pull);
    const scope = spec.fixtures.find((f) => f.pull === row.pull);
    if (!fixture || !scope)
      throw new TypeError("Unknown frozen reliability fixture");
    const charges = requests.filter((r) => r.session === row.id);
    const complete =
      charges.length > 0 &&
      charges.every(
        (r) =>
          r.status === "complete" &&
          Number.isFinite(r.costUsd) &&
          r.costUsd >= 0 &&
          !r.boundExceeded,
      );
    const assessment = assessments.runs[row.id];
    const result = await evaluateVisualTrial(
      {
        ...row,
        billingStatus: complete ? "complete" : "unconfirmed",
        usage: row.usage && {
          ...row.usage,
          estimatedCostUsd: complete
            ? charges.reduce((sum, r) => sum + r.costUsd, 0)
            : null,
        },
      },
      { ...scope, ...fixture, reliability: true },
      assessment,
    );
    evaluated.push({ row, result });
    lines.push(
      `| ${row.id} | ${row.status} | ${row.status === "success" ? "yes" : "no"} | ${row.status === "success" && row.visualValidation?.attempts?.length === 2 ? "yes" : "no"} | ${assessment ? [assessment.sourceAccuracy, assessment.diagramSemantics, assessment.coverageAccuracy].join(" / ") : "unassessed"} | ${result.assessed ? "yes" : "no"} | ${result.assessed ? (result.passes ? "yes" : "no") : "N/A"} |`,
    );
  }
  if (!sessions.length)
    lines.push("| No sessions | unstarted | no | no | unassessed | no | N/A |");
  lines.push(
    "",
    "## Candidate outcome inventory",
    "",
    "Unstarted includes slots without a forwarded request and slots not yet recorded. Budget-limited is a locally ended active session; request-limited is separate. Unavailable includes other failed/interrupted output. Repairs do not replace paid slots. Unknown billing stops the campaign, not just one model.",
    "",
    "<!-- prettier-ignore -->",
    "| Model | Structured / planned | Repaired | Budget-limited | Request-limited | Unstarted | Unavailable | Unassessed structured | Visual passes |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  );
  const models = ledger?.models?.map((m) => m.id) ?? [
    "anthropic/claude-sonnet-5.5",
    "moonshotai/kimi-k2.5",
    "z-ai/glm-5.3",
  ];
  for (const model of models) {
    const rows = evaluated.filter(({ row }) => row.model === model);
    const started = rows.filter(({ row }) =>
      requests.some(
        (r) => r.session === row.id && r.status !== "not-forwarded",
      ),
    );
    const planned = spec.repetitions * spec.fixtures.length;
    const structured = rows.filter(({ row }) => row.status === "success");
    const count = (status) =>
      started.filter(({ row }) => row.status === status).length;
    lines.push(
      `| ${model} | ${structured.length} / ${planned} | ${structured.filter(({ row }) => row.visualValidation?.attempts?.length === 2).length} | ${count("budget-limited")} | ${count("request-limited")} | ${planned - started.length} | ${started.filter(({ row }) => !["success", "budget-limited", "request-limited"].includes(row.status)).length} | ${structured.filter(({ result }) => !result.assessed).length} | ${rows.some(({ result }) => result.assessed) ? rows.filter(({ result }) => result.passes).length : "N/A"} |`,
    );
  }
  lines.push(
    "",
    "## Source assessments",
    "",
    "These are implementation-agent assessments, not independent human approvals. Successful but unassessed sessions do not pass. See the separate source-free request ledger for returned billing and retained reservations.",
    "",
  );
  for (const { row, result } of evaluated) {
    const assessment = assessments.runs[row.id];
    lines.push(`### ${row.id}`, "", `Result: ${result.status}.`, "");
    if (assessment)
      lines.push(
        assessment.notes,
        "",
        ...assessment.falseVisualClaims.map(
          (c) => `- False visual claim: ${c}`,
        ),
        ...assessment.evidence.map((e) => `- Source evidence: ${e}`),
        "",
      );
    else
      lines.push(
        row.status === "success"
          ? "Source assessment pending; not a visual pass."
          : "No usable output; no accuracy score assigned.",
        "",
      );
  }
  if (ledger?.creditReconciliation)
    lines.push(
      "## Credit reconciliation",
      "",
      JSON.stringify(ledger.creditReconciliation),
      "",
    );
  lines.push(
    "## Frozen evidence and versions",
    "",
    `Runner SHA: ${ledger?.runnerSha ?? "not run"}. Pipeline formats: ${JSON.stringify(ledger?.pipelineFormats ?? VISUAL_RELIABILITY_FORMATS)}.`,
    "",
    ...fixtures.map(
      (f) => `- PR #${f.pull}: base ${f.baseSha}; head ${f.headSha}.`,
    ),
    "",
    "All historical campaigns remain closed and unchanged. This offline report does not execute inference, select a model, authorize replacements or enable production.",
    "",
  );
  return lines.join("\n");
}
