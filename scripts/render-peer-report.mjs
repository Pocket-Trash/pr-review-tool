import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { budgetTotal } from "../src/evaluation-budget.mjs";
import {
  adjudicationPasses,
  validateAdjudication,
} from "../src/evaluation.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const ledger = JSON.parse(
  await readFile(join(root, "evaluation/peer-results.json"), "utf8"),
);
let adjudication = { runs: {} };
try {
  adjudication = JSON.parse(
    await readFile(join(root, "evaluation/peer-adjudication.json"), "utf8"),
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const money = (value) => `$${value.toFixed(5)}`;
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length
    ? (sorted[Math.floor((sorted.length - 1) / 2)] +
        sorted[Math.floor(sorted.length / 2)]) /
        2
    : null;
};
const lines = [
  "# Kimi K2.5 and GLM-5.3: independent and peer-filtered evaluation",
  "",
  "OpenRouter only. Additional budget approved: **$10**, separate from the original 54-attempt campaign. Same frozen PRs #403, #354, and #376; three repetitions each. The 36 planned sessions allow up to three separately logged envelope-repair replacements (39 total); all charges count against the same $10. No production route is enabled by this experiment.",
  "",
  "## Quality results",
  "",
  "**Completed** means schema-valid output, not factual correctness. **Passed** requires source-grounded adjudication and all quality gates. **Expected-fact recall** measures preservation of fixture facts, not the truth of every extra claim. Unassessed metrics are N/A, not zero defects. Peer acceptance is not ground truth.",
  "",
  "| Candidate | Completed / planned | Assessed | Passed / planned | Expected-fact recall (assessed only) | Material false claims | False blockers |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
];
for (const candidate of [
  ...ledger.models.map((model) => ({
    name: model.id,
    rows: ledger.sessions.filter(
      (session) =>
        session.stage === "independent" && session.model === model.id,
    ),
  })),
  { name: "Combined, peer-filtered", rows: ledger.combined },
]) {
  const assessed = candidate.rows
    .map((row) => adjudication.runs[row.id])
    .filter(Boolean)
    .map(validateAdjudication);
  const completed = candidate.rows.filter(
    (row) => row.review && (!row.status || row.status === "success"),
  ).length;
  lines.push(
    `| ${candidate.name} | ${completed}/9 | ${assessed.length}/${completed} | ${assessed.filter(adjudicationPasses).length}/9 | ${assessed.length ? (assessed.reduce((sum, a) => sum + a.expectedFactAccuracy, 0) / assessed.length).toFixed(3) : "N/A"} | ${assessed.length ? assessed.reduce((sum, a) => sum + a.falseClaims.length, 0) : "N/A"} | ${assessed.length ? assessed.reduce((sum, a) => sum + a.falseBlockingFindings.length, 0) : "N/A"} |`,
  );
}
lines.push(
  "",
  "## Cost and execution",
  "",
  `Accounted additional spend: **${money(budgetTotal(ledger.requests))} / $10** across ${ledger.requests.length} underlying API requests and ${ledger.sessions.length}/${ledger.maxSessions} started sessions.`,
  "",
  "A session is an OpenCode tool loop, not one API call. Each underlying request is reserved before transmission at the full model context's uncached price plus capped output, with a 1% margin and upstream price ceilings. Actual returned billing cost replaces the reservation when known. Interrupted/unmetered requests retain their reservation; unmetered execution stops further requests. These controls are local to this campaign, not an account-wide provider spending cap.",
  "",
  "| Stage | Successful | Failed | In progress | Accounted cost |",
  "| --- | ---: | ---: | ---: | ---: |",
);
for (const stage of ["independent", "critique"]) {
  const sessions = ledger.sessions.filter((session) => session.stage === stage);
  const ids = new Set(sessions.map((session) => session.id));
  lines.push(
    `| ${stage} | ${sessions.filter((s) => s.status === "success").length}/18 | ${sessions.filter((s) => s.status === "error").length} | ${sessions.filter((s) => s.status === "in-progress").length} | ${money(budgetTotal(ledger.requests.filter((request) => ids.has(request.session))))} |`,
  );
}
lines.push(
  "",
  "Combined results reuse both independent passes and both critiques. Their full pipeline cost includes all four sessions; there is no extra synthesis call.",
  "",
  "## Latency and reported token usage",
  "",
  "Review latency is the median of successful independent sessions only. Tokens are the runner's reported counters across all attempts, not a tokenizer-independent comparison: cached/reasoning counters can overlap or differ by provider and must not be summed as a bill. Request-level provider cost is the accounting source of truth. Three fixed PRs do not establish general code-review quality.",
  "",
  "| Model | Median successful review | Reported input / cached / reasoning / output tokens (all attempts) | Accounted cost, all stages and attempts |",
  "| --- | ---: | ---: | ---: |",
  ...ledger.models.map((model) => {
    const sessions = ledger.sessions.filter(
      (session) => session.model === model.id,
    );
    const latency = median(
      sessions
        .filter(
          (session) =>
            session.stage === "independent" && session.status === "success",
        )
        .map((session) => session.latencyMs),
    );
    const tokens = [
      "inputTokens",
      "cachedInputTokens",
      "reasoningTokens",
      "outputTokens",
    ]
      .map((field) => {
        const values = sessions
          .map((session) => session.usage?.[field])
          .filter((value) => Number.isFinite(value));
        return values.length
          ? values.reduce((sum, value) => sum + value, 0)
          : "N/A";
      })
      .join(" / ");
    return `| ${model.id} | ${latency === null ? "N/A" : `${(latency / 1000).toFixed(1)}s`} | ${tokens} | ${money(budgetTotal(ledger.requests.filter((request) => request.model === model.id)))} |`;
  }),
  "",
  "## Peer filtering",
  "",
  "Each model first reviews the source in a separate workspace/process without seeing peer output. A fresh opposite-model session then checks every original finding and returns exactly one accept/reject/uncertain verdict with evidence and reasoning. The normal coordinator output contract is omitted for critique sessions to avoid conflicting result schemas.",
  "",
  "Only accepted original findings enter the combined finding list; no finding text or severity is rewritten. Exact duplicate objects are removed, but semantic duplicates may remain. Original overviews, changed areas, reviewer-scoped coverage gaps, and up to four validated diagrams are retained rather than synthesized. Rejected and uncertain findings remain traceable in dispositions; their reasoning is not promoted into review claims. Consequently the combined output can still contain false claims outside findings and must be adjudicated independently.",
  "",
  "| Fixture | Repetition | Original findings | Peer accepted | Rejected | Uncertain | Combined findings |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
);
for (const result of ledger.combined) {
  const dispositions = result.dispositions;
  lines.push(
    `| #${result.pull} | ${result.repetition} | ${dispositions.length} | ${dispositions.filter((a) => a.verdict === "accept").length} | ${dispositions.filter((a) => a.verdict === "reject").length} | ${dispositions.filter((a) => a.verdict === "uncertain").length} | ${result.review.findings.length} |`,
  );
}
lines.push(
  "",
  "Source-grounded adjudication must separately identify false claims removed, false claims retained, and valid findings lost; rejection alone does not prove an improvement. See `peer-adjudication.json` for individual assessments and `peer-results.json` for reviews, critiques, provenance, model price snapshots, and request costs.",
  "",
  "### Source-checked filtering outcomes",
  "",
  "| Combined result | False findings removed | Unsupported findings withheld | Mixed findings rejected | Valid findings lost | False findings retained |",
  "| --- | ---: | ---: | ---: | ---: | ---: |",
  ...Object.entries(adjudication.filtering || {}).map(
    ([id, value]) =>
      `| ${id} | ${value.removedFalseFindings.length} | ${value.withheldUnsupportedFindings.length} | ${value.rejectedMixedFindings.length} | ${value.lostValidFindings.length} | ${value.retainedFalseFindings.length} |`,
  ),
  "",
  "Counts are finding-level judgments, not percentages of all real defects. A rejected mixed finding may contain a real risk already retained from the other reviewer. Consult the detailed notes before interpreting a rejection as either a success or a missed defect.",
  "",
  "## Operational failures",
  "",
);
const failures = ledger.sessions.filter(
  (session) => session.status !== "success",
);
lines.push(
  ...(failures.length
    ? failures.map(
        (session) =>
          `- ${session.id}: ${session.status}${session.error ? ` — ${session.error.replaceAll("\n", " ")}` : ""}`,
      )
    : ["None recorded."]),
);
lines.push(
  "",
  "## Verified model price ceilings",
  "",
  "Prices per million tokens. Initial ceilings came from the catalog; GLM's output ceiling was subsequently raised to the owner's quoted $2.20/M when the initial $1/M route became unavailable. The $10 campaign cap did not change. Historical reservations and routing rejections remain recorded. Cached input may cost less.",
  "",
  "| Exact model | Input | Output |",
  "| --- | ---: | ---: |",
  ...ledger.models.map(
    (model) =>
      `| ${model.id} | $${model.inputPerMillionUsd} | $${model.outputPerMillionUsd} |`,
  ),
  "",
);
if (ledger.providerUsageBefore && ledger.providerUsageAfter)
  lines.push(
    `Provider key-wide usage difference: ${money(ledger.providerUsageAfter.usage - ledger.providerUsageBefore.usage)}. This is a cross-check, not proof that concurrent key usage belongs to this campaign.`,
    "",
  );
await writeFile(join(root, "evaluation/peer-report.md"), lines.join("\n"));
