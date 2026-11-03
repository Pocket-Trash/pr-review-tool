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
  const uncovered =
    catalog && requirements.schema !== "none"
      ? missingSchemaChanges(review, catalog.schemaChanges)
      : [];
  for (const change of uncovered)
    diagnostics.push({
      kind: "schema-er",
      code: "changed-entity-missing",
      entity: change.name,
    });
  return {
    review,
    diagnostics,
    missing: [
      ...new Set([
        ...missingRequiredVisuals(review, requirements),
        ...(uncovered.length ? ["schema-er"] : []),
      ]),
    ],
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

export function missingSchemaChanges(review, changes = []) {
  if (!Array.isArray(changes) || changes.length > 128)
    throw new TypeError("Invalid changed schema scope");
  return changes.filter((change) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(change.name ?? ""))
      throw new TypeError("Invalid changed entity name");
    return !review.diagrams.some(
      (d) =>
        d.kind === "schema-er" && d.mermaid.includes(`\n  ${change.name} {`),
    );
  });
}
