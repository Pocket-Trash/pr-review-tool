import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  accountedRunCost,
  adjudicationPasses,
  validateAdjudication,
  usesCorrectedRunner,
} from "../src/evaluation.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const [results, adjudication] = await Promise.all([
  readFile(join(root, "evaluation/results.json"), "utf8").then(JSON.parse),
  readFile(join(root, "evaluation/adjudication.json"), "utf8").then(JSON.parse),
]);
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};
const money = (value) => `$${value.toFixed(5)}`;
const catalogAvailable = (entry) =>
  typeof entry === "boolean" ? entry : entry?.available === true;
const rows = [];
for (const candidate of results.matrix.candidates) {
  const runs = results.runs.filter(
    ({ provider, model }) =>
      provider === candidate.provider && model === candidate.model,
  );
  const assessed = runs
    .map((run) => adjudication.runs[run.id])
    .filter(Boolean)
    .map(validateAdjudication);
  const accountedCost = runs.reduce(
    (total, run) => total + accountedRunCost(run),
    0,
  );
  const passes =
    runs.length ===
      results.matrix.fixtures.length * results.matrix.repetitions &&
    runs.every(
      (run) =>
        run.status === "success" &&
        usesCorrectedRunner(run) &&
        adjudication.runs[run.id] &&
        adjudicationPasses(adjudication.runs[run.id]),
    );
  rows.push({
    candidate,
    runs,
    assessed,
    accountedCost,
    passes,
    medianLatency: median(
      runs
        .filter(({ status }) => status === "success")
        .map((run) => run.latencyMs),
    ),
  });
}
const eligible = rows.filter(({ passes }) => passes);
const cheapest = eligible.sort((a, b) => a.accountedCost - b.accountedCost)[0];

const lines = [
  "# Provider and model evaluation",
  "",
  `Generated from frozen SHA fixtures at ${new Date().toISOString()}.`,
  "",
  "Runs without `contextFormat: plain-text-v1` used JSON-escaped multiline evidence, which OpenCode's read tool truncates at 2,000 characters per line. Their output remains in the ledger for cost and failure accounting, but is not a valid model comparison. Interrupted reservations are preserved and are never replayed automatically. A production decision requires every repetition to use readable evidence.",
  "",
  "Runs without `validatorFormat: node-dom-v1` also predate the Node DOM initialization required by Mermaid's labeled flowchart parser. Some reported syntax failures were validator errors, so those runs cannot support a production selection. Raw-HTML and other explicit safety rejections remain enforced.",
  "",
  "Accounted costs combine reported usage and local reservations. Interrupted calls can cost more than their reservation and have no final token telemetry; these amounts are estimates, not an authoritative provider bill. Reconcile the interrupted rows with the dedicated provider key's usage ledger before approving replacement runs.",
  "",
  "Runs without `outputFormat: final-message-v1` used a parser that concatenated narration from earlier assistant messages with the final answer. Their structured-output errors may be runner errors rather than invalid final model responses. Successful JSON results remain available for factual adjudication, but earlier parse failures cannot establish model reliability.",
  "",
  "| Provider | Model | Runs | Corrected runner | Failures | Reconcile | Assessed | Accuracy | False claims/blockers | Gate failures (boundary/artifact/coverage/diagram/telemetry/loop) | Median latency | Tokens (in/cached/reasoning/out) | Calls/tools | Accounted cost | Status |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
];
for (const row of rows) {
  const input = row.runs.reduce(
    (total, run) => total + (run.usage?.inputTokens || 0),
    0,
  );
  const output = row.runs.reduce(
    (total, run) => total + (run.usage?.outputTokens || 0),
    0,
  );
  const nullableTotal = (field) => {
    const values = row.runs
      .map((run) => run.usage?.[field])
      .filter((value) => value !== null && value !== undefined);
    return values.length
      ? values.reduce((total, value) => total + value, 0)
      : "—";
  };
  const accuracy = row.assessed.length
    ? row.assessed.reduce(
        (total, assessment) => total + assessment.expectedFactAccuracy,
        0,
      ) / row.assessed.length
    : null;
  const falseClaims = row.assessed.reduce(
    (total, assessment) => total + assessment.falseClaims.length,
    0,
  );
  const falseBlockers = row.assessed.reduce(
    (total, assessment) => total + assessment.falseBlockingFindings.length,
    0,
  );
  const boundaryFailures = row.assessed.filter(
    ({ toolBoundaryBehavior }) => toolBoundaryBehavior !== "held",
  ).length;
  const diagramFailures = row.assessed.filter(
    ({ diagramQuality }) => diagramQuality === "fail",
  ).length;
  const artifactFailures = row.assessed.filter(
    ({ generatedArtifactOmission }) => generatedArtifactOmission !== "pass",
  ).length;
  const coverageFailures = row.assessed.filter(
    ({ coverageAccuracy }) => coverageAccuracy !== "pass",
  ).length;
  const telemetryFailures = row.assessed.filter(
    ({ stableTelemetry }) => stableTelemetry !== "pass",
  ).length;
  const loopFailures = row.assessed.filter(
    ({ fullToolLoop }) => fullToolLoop !== "pass",
  ).length;
  const available = catalogAvailable(
    results.catalogs[row.candidate.provider]?.models[row.candidate.model],
  );
  lines.push(
    `| ${row.candidate.provider} | ${row.candidate.model} | ${row.runs.length}/9 | ${row.runs.filter(usesCorrectedRunner).length}/9 | ${row.runs.filter(({ status, error }) => status === "error" || error).length} | ${row.runs.filter(({ status }) => status === "in-progress").length} | ${row.assessed.length}/${row.runs.length} | ${accuracy === null ? "—" : accuracy.toFixed(3)} | ${falseClaims}/${falseBlockers} | ${boundaryFailures}/${artifactFailures}/${coverageFailures}/${diagramFailures}/${telemetryFailures}/${loopFailures} | ${row.medianLatency === null ? "—" : `${(row.medianLatency / 1000).toFixed(1)}s`} | ${input}/${nullableTotal("cachedInputTokens")}/${nullableTotal("reasoningTokens")}/${output} | ${nullableTotal("modelCalls")}/${nullableTotal("toolIterations")} | ${money(row.accountedCost)} | ${row.passes ? "pass" : !available ? "unavailable" : row.runs.length ? "incomplete/fail" : "blocked"} |`,
  );
}
lines.push(
  "",
  "## Catalog verification",
  "",
  ...Object.entries(results.catalogs).map(
    ([provider, catalog]) =>
      `- ${provider}: ${Object.entries(catalog.models)
        .map(([model, entry]) => {
          const pricing =
            typeof entry === "object" && entry.pricing
              ? `, $${entry.pricing.inputPerMillionUsd}/$${entry.pricing.outputPerMillionUsd} per 1M input/output`
              : "";
          return `${model}=${catalogAvailable(entry) ? "available" : "missing"}${pricing}`;
        })
        .join(
          ", ",
        )} (${catalog.authenticated ? "authenticated" : "public catalog"})`,
  ),
  "",
  "## Adjudication",
  "",
  "Each successful repetition must be recorded in `adjudication.json` with expected-fact accuracy, false claims, false blocking findings, tool-boundary behavior, generated-artifact omission, coverage accuracy, diagram quality, stable telemetry, full-tool-loop completion, and a pass decision. Automated keyword matches are retained only as recall signals and never determine the winner.",
  "",
  cheapest
    ? `Cheapest candidate passing every repetition: **${cheapest.candidate.provider} / ${cheapest.candidate.model}** (${money(cheapest.accountedCost)}).`
    : "No candidate can be selected yet: the fixed matrix and human adjudication are incomplete or contain failures.",
  "",
  "Production routing and cross-provider failover remain disabled pending the project owner's decision.",
  "",
);
await writeFile(join(root, "evaluation/report.md"), lines.join("\n"));
