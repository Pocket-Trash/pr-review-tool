const providers = new Set(["cheaperinference", "openrouter"]);
const severities = new Set(["critical", "high", "medium", "low"]);
const diagramKinds = new Set(["architecture", "schema-domain", "schema-er"]);

function fail(path, expected) {
  throw new TypeError(`${path} must be ${expected}`);
}

function object(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "an object");
  }
  return value;
}

function string(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(path, "a non-empty string");
  }
  return value;
}

function strings(value, path) {
  if (!Array.isArray(value)) fail(path, "an array");
  return value.map((item, index) => string(item, `${path}[${index}]`));
}

function integer(value, path, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) {
    fail(path, `an integer >= ${minimum}`);
  }
  return value;
}

function exactKeys(value, path, keys) {
  const unknown = Object.keys(value).filter((key) => !keys.includes(key));
  if (unknown.length)
    fail(path, `free of unknown fields (${unknown.join(", ")})`);
}

export function validateConfig(input) {
  const config = object(input, "config");
  exactKeys(config, "config", [
    "provider",
    "model",
    "skills",
    "prompt",
    "generatedFiles",
    "limits",
  ]);
  if (!providers.has(config.provider))
    fail("config.provider", "cheaperinference or openrouter");
  string(config.model, "config.model");
  strings(config.skills, "config.skills");
  string(config.prompt, "config.prompt");
  strings(config.generatedFiles, "config.generatedFiles");

  const limits = object(config.limits, "config.limits");
  exactKeys(limits, "config.limits", [
    "maxFiles",
    "maxBytes",
    "maxChangedLines",
    "maxFileBytes",
  ]);
  integer(limits.maxFiles, "config.limits.maxFiles", 1);
  integer(limits.maxBytes, "config.limits.maxBytes", 1);
  integer(limits.maxChangedLines, "config.limits.maxChangedLines", 1);
  integer(limits.maxFileBytes, "config.limits.maxFileBytes", 1);
  return config;
}

export function validateReview(input) {
  const review = object(input, "review");
  exactKeys(review, "review", [
    "overview",
    "findings",
    "diagrams",
    "changedAreas",
    "coverageGaps",
  ]);
  string(review.overview, "review.overview");
  strings(review.coverageGaps, "review.coverageGaps");

  if (!Array.isArray(review.findings)) fail("review.findings", "an array");
  for (const [index, value] of review.findings.entries()) {
    const finding = object(value, `review.findings[${index}]`);
    exactKeys(finding, `review.findings[${index}]`, [
      "severity",
      "title",
      "file",
      "line",
      "evidence",
      "impact",
      "recommendation",
    ]);
    if (!severities.has(finding.severity))
      fail(`review.findings[${index}].severity`, "a supported severity");
    for (const key of [
      "title",
      "file",
      "evidence",
      "impact",
      "recommendation",
    ]) {
      string(finding[key], `review.findings[${index}].${key}`);
    }
    integer(finding.line, `review.findings[${index}].line`, 1);
  }

  if (!Array.isArray(review.diagrams)) fail("review.diagrams", "an array");
  for (const [index, value] of review.diagrams.entries()) {
    const diagram = object(value, `review.diagrams[${index}]`);
    exactKeys(diagram, `review.diagrams[${index}]`, [
      "kind",
      "title",
      "mermaid",
    ]);
    if (!diagramKinds.has(diagram.kind))
      fail(`review.diagrams[${index}].kind`, "a supported diagram kind");
    string(diagram.title, `review.diagrams[${index}].title`);
    string(diagram.mermaid, `review.diagrams[${index}].mermaid`);
  }

  if (!Array.isArray(review.changedAreas))
    fail("review.changedAreas", "an array");
  for (const [index, value] of review.changedAreas.entries()) {
    const area = object(value, `review.changedAreas[${index}]`);
    exactKeys(area, `review.changedAreas[${index}]`, ["area", "summary"]);
    string(area.area, `review.changedAreas[${index}].area`);
    string(area.summary, `review.changedAreas[${index}].summary`);
  }
  return review;
}

export function validateRun(input) {
  const run = object(input, "run");
  exactKeys(run, "run", [
    "reviewedSha",
    "runId",
    "selectedSkills",
    "skillOverrides",
    "usage",
  ]);
  string(run.reviewedSha, "run.reviewedSha");
  string(run.runId, "run.runId");
  strings(run.selectedSkills, "run.selectedSkills");
  strings(run.skillOverrides, "run.skillOverrides");

  const usage = object(run.usage, "run.usage");
  exactKeys(usage, "run.usage", [
    "inputTokens",
    "outputTokens",
    "estimatedCostUsd",
  ]);
  integer(usage.inputTokens, "run.usage.inputTokens");
  integer(usage.outputTokens, "run.usage.outputTokens");
  if (
    typeof usage.estimatedCostUsd !== "number" ||
    usage.estimatedCostUsd < 0
  ) {
    fail("run.usage.estimatedCostUsd", "a number >= 0");
  }
  return run;
}

export function renderReview(configInput, reviewInput, runInput) {
  const config = validateConfig(configInput);
  const review = validateReview(reviewInput);
  const run = validateRun(runInput);
  const findings = review.findings.length
    ? review.findings
        .map(
          (finding) =>
            `### ${finding.severity.toUpperCase()}: ${finding.title}\n\n**${finding.file}:${finding.line}** — ${finding.evidence}\n\nImpact: ${finding.impact}\n\nSmallest fix: ${finding.recommendation}`,
        )
        .join("\n\n")
    : "No findings found in the supplied diff.";
  const diagrams = review.diagrams.length
    ? review.diagrams
        .map(
          (diagram) =>
            `### ${diagram.title}\n\n\`\`\`mermaid\n${diagram.mermaid}\n\`\`\``,
        )
        .join("\n\n")
    : "No diagram was needed for this change.";
  const areas = review.changedAreas
    .map(({ area, summary }) => `- **${area}:** ${summary}`)
    .join("\n");
  const gaps = review.coverageGaps.length
    ? review.coverageGaps.map((gap) => `- ${gap}`).join("\n")
    : "- None.";

  const overrides = run.skillOverrides.length
    ? `\nSkill overrides: ${run.skillOverrides.join(", ")}`
    : "";
  return `## Overview\n\n${review.overview}\n\n## Findings\n\n${findings}\n\n## Architecture and schema\n\n${diagrams}\n\n## Changed areas\n\n${areas}\n\n## Coverage gaps\n\n${gaps}\n\n<details>\n<summary>Run and cost details</summary>\n\nProvider: ${config.provider}\nModel: ${config.model}\nReviewed SHA: ${run.reviewedSha}\nRun: ${run.runId}\nSkills: ${run.selectedSkills.join(", ") || "none"}${overrides}\nTokens: ${run.usage.inputTokens} input, ${run.usage.outputTokens} output\nEstimated cost: $${run.usage.estimatedCostUsd.toFixed(5)}\n\n</details>\n`;
}
