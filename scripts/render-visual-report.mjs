import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { budgetTotal } from "../src/evaluation-budget.mjs";
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
let catalog = await json("evaluation/visual-catalog.json");
let fresh = { sessions: [] };
try {
  fresh = await json("evaluation/visual-results.json");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (fresh.models)
  catalog = {
    source: "https://openrouter.ai/api/v1/models",
    verifiedAt: fresh.catalogVerifiedAt,
    models: fresh.models,
  };
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
  fresh.sessions.length
    ? `New visual-only campaign: ${fresh.status}. Approved cap $${fresh.budgetUsd}; ${fresh.sessions.length}/${fresh.maxSessions} sessions and ${fresh.requests.length}/${fresh.maxRequests} API requests. Accounted spend including retained reservations: $${budgetTotal(fresh.requests).toFixed(6)}. No paid replacements. The owner's exact provider/model/failover decision remains pending.`
    : `No fresh visual-only inference has run. A new $${spec.budgetUsd} cap is approved for at most ${spec.maxSessions} sessions / ${spec.maxRequests} API requests; failed charges and retained reservations count. The owner's exact provider/model/failover decision remains pending. The earlier $10 peer campaign is closed.`,
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
if (fresh.creditReconciliation)
  lines.splice(
    3,
    0,
    "",
    `Read-only credit reconciliation at ${fresh.creditReconciliation.checkedAt}: $${fresh.creditReconciliation.beforeUsd.toFixed(6)} before, $${fresh.creditReconciliation.afterUsd.toFixed(6)} after. The decrease matches $${fresh.creditReconciliation.returnedBilledUsd.toFixed(6)} in request charges; ${fresh.creditReconciliation.outstandingReservations} outstanding reservations.`,
  );
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
  lines.push("| No fresh sessions | approved, not run | N/A | N/A |");
const evaluated = [];
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
    {
      ...row,
      billingStatus,
      usage: row.usage && {
        ...row.usage,
        estimatedCostUsd:
          billingStatus === "complete"
            ? requests.reduce((sum, request) => sum + request.costUsd, 0)
            : row.usage.estimatedCostUsd,
      },
    },
    requirementsFor(row.pull),
    assessments.runs[row.id],
  );
  lines.push(
    `| ${row.id} | ${result.status} | ${result.assessed ? "yes" : "no"} | ${result.passes ? "yes" : "no"} |`,
  );
  evaluated.push({ row, result, requests, billingStatus });
}
if (fresh.sessions.length) {
  lines.push(
    "",
    "## Candidate completion, quality and cost",
    "",
    "Each candidate has nine planned sessions. Passes require a source assessment, not just JSON/Mermaid validity. Accounted cost includes failed-call reservations; returned billed cost excludes unknown charges. Mean latency uses known attempt durations, including validation failures; interrupted sessions with no final duration are excluded, not assigned zero. The gate uses returned request billing rather than treating missing SDK cost as zero. One Kimi PR 403 repetition-three session was interrupted and not replaced; its last request charge was reconciled from the provider's generation receipt.",
    "",
    "<!-- prettier-ignore -->",
    "| Model | Attempted / planned | Completed | Failed / unfinished | Source assessed | Visual passes | False visual claims | Requests | Accounted USD | Returned billed USD | Mean latency seconds |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  );
  for (const model of fresh.models) {
    const entries = evaluated.filter(({ row }) => row.model === model.id);
    const requests = fresh.requests.filter(
      (request) => request.model === model.id,
    );
    const assessed = entries.filter(({ result }) => result.assessed);
    const claims = assessed.reduce(
      (total, { row }) =>
        total + assessments.runs[row.id].falseVisualClaims.length,
      0,
    );
    const latencies = entries
      .map(({ row }) => row.latencyMs)
      .filter(Number.isFinite);
    lines.push(
      `| ${model.id} | ${entries.length} / 9 | ${entries.filter(({ row }) => row.status === "success").length} | ${entries.filter(({ row }) => row.status !== "success").length} | ${assessed.length} | ${assessed.length ? entries.filter(({ result }) => result.passes).length : "N/A"} | ${assessed.length ? claims : "N/A"} | ${requests.length} | ${budgetTotal(requests).toFixed(6)} | ${requests
        .filter((request) => Number.isFinite(request.costUsd))
        .reduce((sum, request) => sum + request.costUsd, 0)
        .toFixed(
          6,
        )} | ${latencies.length ? (latencies.reduce((sum, value) => sum + value, 0) / latencies.length / 1000).toFixed(1) : "N/A"} |`,
    );
  }
  const clearsGate = fresh.models.filter((model) => {
    const entries = evaluated.filter(({ row }) => row.model === model.id);
    return entries.length === 9 && entries.every(({ result }) => result.passes);
  });
  lines.push(
    "",
    clearsGate.length
      ? `Candidates meeting all nine dedicated visual trials: ${clearsGate.map((model) => model.id).join(", ")}. Owner route approval is still required.`
      : "No candidate clears all nine dedicated visual trials. Structured completion alone is not a visual quality pass; keep model adoption disabled.",
    "",
  );
  lines.push("", "## Dedicated source assessment notes", "");
  lines.push(
    "These are implementation-agent adjudications against frozen source, not independent human approvals. False-claim counts group related errors; they are not an accuracy percentage or a count of all possible assertions. Incidental count/wording mistakes are distinguished from material topology/cardinality errors in the notes.",
    "",
  );
  for (const { row, result } of evaluated) {
    const assessment = assessments.runs[row.id];
    lines.push(
      `### ${row.id}`,
      "",
      `Result: ${result.status}; execution status: ${row.status}.`,
      "",
    );
    if (assessment)
      lines.push(
        assessment.notes,
        "",
        ...assessment.falseVisualClaims.map(
          (claim) => `- False visual claim: ${claim}`,
        ),
        ...assessment.evidence.map(
          (evidence) => `- Source evidence: ${evidence}`,
        ),
        "",
      );
    else
      lines.push(
        row.status === "success"
          ? "Source assessment pending; this completion is not a visual pass."
          : "No usable dedicated visual output; no zero-defect or accuracy score assigned.",
        "",
      );
  }
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
  "This campaign has a separately approved $7.89 cumulative cap and 27-session / 432-request ceilings, with no paid replacements. Returned per-request billing supplies gate cost when complete; unknown/retained request billing cannot pass. Stop before a conservative reservation cannot fit, even if the nominal balance is positive. Any further campaign or replacement needs new authorization. No production model is selected; the owner's exact provider/model/failover approval and live adoption checks remain required. The report command itself is offline and cannot execute inference.",
  "",
);
await writeFile(
  process.argv[2] || join(root, "evaluation/visual-report.md"),
  lines.join("\n").replace(/\n{3,}/g, "\n\n"),
);
