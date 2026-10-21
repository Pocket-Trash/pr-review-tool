import { validateVisualAnalysis, visualDiagramKinds } from "./review.mjs";
import { renderEvidenceVisuals } from "./relationships.mjs";
import { sanitizeVisuals, missingRequiredVisuals } from "./visuals.mjs";

export const VISUAL_RELIABILITY_FORMATS = Object.freeze({
  runner: "phase1-facts-v3",
  prompt: "host-fact-selection-v3",
  evidence: "frozen-evidence-v1",
  relationships: "visual-relationships-v1",
  repair: "single-pass-facts-v3",
  budget: "session-capability-full-context-v1",
});

export async function validateVisualAttempt(
  value,
  requirements,
  phase,
  catalog,
) {
  if (!Array.isArray(value?.diagrams) || value.diagrams.length > 16)
    throw new TypeError("Visual diagrams must be a bounded array");
  validateVisualAnalysis({ ...value, diagrams: [] }, phase);
  const diagnostics = [];
  const diagrams = [];
  for (const diagram of value.diagrams) {
    try {
      const candidate = { ...value, diagrams: [diagram] };
      const rendered = catalog
        ? renderEvidenceVisuals(candidate, catalog)
        : candidate;
      validateVisualAnalysis(rendered, phase);
      diagrams.push(...rendered.diagrams);
    } catch (error) {
      diagnostics.push({
        kind: visualDiagramKinds(phase).includes(diagram?.kind)
          ? diagram.kind
          : "unknown",
        code: "evidence-or-contract",
        reason: [
          "Invalid evidence diagram selection",
          "Diagram contains unmatched relationship evidence",
          "Diagram evidence kind mismatch",
          "Ambiguous entity names",
        ].includes(error.message)
          ? error.message
          : "Invalid diagram contract",
      });
    }
  }
  const review = await sanitizeVisuals(
    { ...value, diagrams },
    requirements,
    undefined,
    diagnostics,
  );
  return {
    review,
    diagnostics,
    missing: missingRequiredVisuals(review, requirements),
  };
}

export function visualFailure(diagnostics) {
  return Object.assign(
    new Error("Required visual diagrams remain missing or unsupported."),
    {
      code: "VISUAL_REQUIRED_MISSING",
      diagnostics,
    },
  );
}
