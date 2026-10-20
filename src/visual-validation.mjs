import { validateVisualAnalysis, visualDiagramKinds } from "./review.mjs";
import { renderEvidenceVisuals } from "./relationships.mjs";
import { sanitizeVisuals, missingRequiredVisuals } from "./visuals.mjs";

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
    } catch {
      diagnostics.push({
        kind: visualDiagramKinds(phase).includes(diagram?.kind)
          ? diagram.kind
          : "unknown",
        code: "evidence-or-contract",
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
