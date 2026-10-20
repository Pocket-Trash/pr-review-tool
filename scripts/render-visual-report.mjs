import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  inspectHistoricalVisuals,
  evaluateVisualTrial,
} from "../src/visual-evaluation.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const json = async (path) =>
  JSON.parse(await readFile(join(root, path), "utf8"));
const [matrix, original, peers, prior, peerPrior, spec, assessments] =
  await Promise.all([
    json("evaluation/matrix.json"),
    json("evaluation/results.json"),
    json("evaluation/peer-results.json"),
    json("evaluation/adjudication.json"),
    json("evaluation/peer-adjudication.json"),
    json("evaluation/visual-fixtures.json"),
    json("evaluation/visual-assessments.json"),
  ]);
const catalog = await json("evaluation/visual-catalog.json");
let fresh = { sessions: [] };
try {
  fresh = await json("evaluation/visual-results.json");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const requirementsFor = (pull) => {
  const fixture = spec.fixtures.find((fixture) => fixture.pull === pull);
  if (!fixture) throw new TypeError(`unknown visual fixture: ${pull}`);
  const frozen = matrix.fixtures.find((entry) => entry.pull === pull);
  return {
    architecture: fixture.architecture,
    schema: fixture.schema,
    baseSha: frozen.baseSha,
    headSha: frozen.headSha,
  };
};
const histories = [
  ...original.runs.map((row) => ({
    row,
    assessment: prior.runs[row.id],
    provider: row.provider,
  })),
  ...peers.sessions
    .filter((row) => row.stage === "independent")
    .map((row) => ({
      row,
      assessment: peerPrior.runs[row.id],
      provider: "openrouter",
    })),
];
const inspected = await Promise.all(
  histories.map(async ({ row, assessment, provider }) => ({
    id: row.id,
    candidate: `${provider}/${row.model}`,
    pull: row.pull,
    ...(await inspectHistoricalVisuals(
      row,
      requirementsFor(row.pull),
      assessment,
    )),
  })),
);
const lines = [
  "# Phase 1 visual-only evaluation",
  "",
  "No fresh visual-only inference has run. The separate spend/session/request approval and the owner's exact provider/model/failover decision are pending. The earlier $10 peer campaign is closed; its unspent arithmetic balance is not new authorization.",
  "",
  "## Historical visual evidence",
  "",
  "These are existing combined-review outputs, not visual-task completions. Corrected-runner outputs are inspected for current visual syntax/scope; the prior source-grounded diagram verdict is shown separately. Full-review findings, overall pass/fail and expected-fact recall do not determine the visual gate. Prior diagram passes do not assess all descriptive prose/omissions under the new task. Peer-filtered combinations are excluded because they retain the same independent visuals rather than adding independent evidence.",
  "",
  "**Unavailable** includes failed/interrupted/missing output; **runner-ineligible** predates one or more evidence/DOM/final-message fixes. Neither is scored as zero false claims or perfect accuracy. **Unassessed** is not a pass. Historical costs remain in the original ledgers and are not quoted as visual-only costs.",
  "",
  "<!-- prettier-ignore -->",
  "| Candidate | Attempts | Usable historical output | Current syntax/scope pass | Prior diagram pass / fail / unassessed |",
  "| --- | ---: | ---: | ---: | ---: |",
];
for (const candidate of [...new Set(inspected.map((row) => row.candidate))]) {
  const rows = inspected.filter((row) => row.candidate === candidate);
  const usable = rows.filter((row) => row.status === "historical-only");
  const count = (gate) =>
    usable.filter((row) => row.priorDiagramGate === gate).length;
  lines.push(
    `| ${candidate} | ${rows.length} | ${usable.length} | ${usable.filter((row) => row.syntax).length} | ${usable.length ? `${count("pass")} / ${count("fail")} / ${count("unassessed") + count("not-applicable")}` : "N/A"} |`,
  );
}
lines.push(
  "",
  "## Dedicated visual-task gate",
  "",
  "All three repetitions of every frozen fixture must complete the strict four-key visual contract, pass source/diagram/omission checks, preserve denied-tool boundaries, report stable telemetry and returned request billing, and finish within 15 minutes. No candidate is selected from historical evidence alone.",
  "",
  "<!-- prettier-ignore -->",
  "| Session | Result | Assessed | Visual pass |",
  "| --- | --- | --- | --- |",
);
if (!fresh.sessions.length)
  lines.push("| No fresh sessions | awaiting approval | N/A | N/A |");
for (const row of fresh.sessions) {
  const requests = (fresh.requests ?? []).filter(
    (request) => request.session === row.id,
  );
  const billingStatus =
    requests.length > 0 &&
    requests.every(
      (request) =>
        request.status === "complete" &&
        Number.isFinite(request.costUsd) &&
        request.costUsd >= 0 &&
        !request.boundExceeded,
    )
      ? "complete"
      : "unconfirmed";
  const result = await evaluateVisualTrial(
    { ...row, billingStatus },
    requirementsFor(row.pull),
    assessments.runs[row.id],
  );
  lines.push(
    `| ${row.id} | ${result.status} | ${result.assessed ? "yes" : "no"} | ${result.passes ? "yes" : "no"} |`,
  );
}
lines.push("", "## Frozen fixtures and source checks", "");
for (const fixture of spec.fixtures) {
  const frozen = matrix.fixtures.find((entry) => entry.pull === fixture.pull);
  lines.push(
    `### PR #${fixture.pull}`,
    "",
    `Base: ${frozen.baseSha}; head: ${frozen.headSha}.`,
    "",
    ...fixture.sourceChecks.map((check) => `- ${check}`),
    "",
  );
}
lines.push(
  "## Per-attempt inventory",
  "",
  "<!-- prettier-ignore -->",
  "| Attempt | Evidence status | Current syntax/scope | Prior source diagram verdict |",
  "| --- | --- | --- | --- |",
);
for (const row of inspected)
  lines.push(
    `| ${row.id} | ${row.status} | ${row.status === "historical-only" ? (row.syntax ? "pass" : "fail") : "N/A"} | ${row.priorDiagramGate ?? "N/A"} |`,
  );
lines.push(
  "",
  "## Read-only catalog snapshot",
  "",
  `Verified from ${catalog.source} at ${catalog.verifiedAt}; no inference was executed. Prices are USD per million tokens, not an estimate of full tool-loop cost.`,
  "",
  "<!-- prettier-ignore -->",
  "| Exact OpenRouter model | Input / output | Context tokens |",
  "| --- | ---: | ---: |",
  ...catalog.models.map(
    (model) =>
      `| ${model.id} | $${model.inputPerMillionUsd} / $${model.outputPerMillionUsd} | ${model.contextLength} |`,
  ),
);
lines.push(
  "",
  "## Next approval",
  "",
  "Before fresh inference, record exact available model IDs and current catalog prices, a new cumulative dollar cap plus session/request ceilings, and the owner approval. Reuse the request-reserving proxy and keep a separate ledger; never reset/replay the original campaigns. The report command itself is offline and cannot execute inference.",
  "",
);
await writeFile(
  process.argv[2] || join(root, "evaluation/visual-report.md"),
  lines.join("\n"),
);
