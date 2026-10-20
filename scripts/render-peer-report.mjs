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
  "OpenRouter only. Additional budget approved: **$10**, separate from the original 54-attempt campaign. Same frozen PRs #403, #354, and #376; three repetitions each. The 36 planned sessions allow five labelled runner-repair replacements (41 total): three Kimi prose-envelope cases and two provider-confirmed GLM output-cap truncations. All charges count against the same $10. No production route is enabled by this experiment.",
  "",
  "## Quality results",
  "",
  "**Completed** means schema-valid output, not factual correctness. **Passed** requires source-grounded findings without material false claims or false blockers, accurate coverage/omission reporting, relevant and semantically correct diagrams, stable telemetry, and a completed tool loop within the runtime limit. Unassessed metrics are N/A, not zero defects. Expected-fact recall remains in the detailed assessment JSON; it is not an overall accuracy score. Peer acceptance is not ground truth. Assessments are agent source-checks, not a blinded human adjudication or a measurement of recall across every real defect.",
  "",
  "Three initial Kimi infrastructure attempts were rejected by prose-envelope handling and remain unassessed; their replacements use repaired extraction. One schema review was recovered from the same local session without another paid inference. OpenRouter confirmed that two GLM schema attempts ended at the runner's original 16,384-native-token cap (finish_reason: length); their replacements use 32,768 tokens. The early completed outputs and later larger-cap outputs are exploratory observations under these recorded runner changes, not a controlled model-only reliability ranking. Attempt failures and their costs remain visible below.",
  "",
  "| Candidate | Completed / planned | Assessed | Passed / planned | Material false claims | False blockers |",
  "| --- | ---: | ---: | ---: | ---: | ---: |",
];
const candidates = [
  ...ledger.models.map((model) => ({
    name: model.id,
    rows: ledger.sessions.filter(
      (session) =>
        session.stage === "independent" && session.model === model.id,
    ),
  })),
  { name: "Combined, peer-filtered", rows: ledger.combined },
];
for (const candidate of candidates) {
  const assessed = candidate.rows
    .map((row) => adjudication.runs[row.id])
    .filter(Boolean)
    .map(validateAdjudication);
  const completed = candidate.rows.filter(
    (row) => row.review && (!row.status || row.status === "success"),
  ).length;
  lines.push(
    `| ${candidate.name} | ${completed}/9 | ${assessed.length}/${completed} | ${assessed.filter(adjudicationPasses).length}/9 | ${assessed.length ? assessed.reduce((sum, a) => sum + a.falseClaims.length, 0) : "N/A"} | ${assessed.length ? assessed.reduce((sum, a) => sum + a.falseBlockingFindings.length, 0) : "N/A"} |`,
  );
}
lines.push(
  "",
  "### Why assessed reviews failed",
  "",
  "Claim counts above are occurrences across assessed outputs, including repeated errors, not unique defect types. Counts below are reviews failing each gate, not counts of defects. One review can fail several gates. Unavailable output is reported in completion and operational failures, never adjudicated as zero defects.",
  "",
  "| Candidate | Material claim/blocker error | Diagram gate | Coverage/omission gate | Tool/telemetry/loop gate |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...candidates.map((candidate) => {
    const rows = candidate.rows
      .map((row) => adjudication.runs[row.id])
      .filter(Boolean);
    const count = (predicate) =>
      rows.length ? rows.filter(predicate).length : "N/A";
    return `| ${candidate.name} | ${count((a) => a.falseClaims.length > 0 || a.falseBlockingFindings.length > 0)} | ${count((a) => a.diagramQuality === "fail")} | ${count((a) => a.coverageAccuracy !== "pass" || a.generatedArtifactOmission !== "pass")} | ${count((a) => a.toolBoundaryBehavior !== "held" || a.stableTelemetry !== "pass" || a.fullToolLoop !== "pass")} |`;
  }),
);
if (
  candidates.every((candidate) =>
    candidate.rows.some((row) => {
      const assessment = adjudication.runs[row.id];
      return assessment && !adjudicationPasses(assessment);
    }),
  )
)
  lines.push(
    "",
    "Neither independent model nor the combined pipeline satisfies the every-repetition gate: each has at least one assessed failure. These results do not select a production route. Further paid attempts beyond this recorded campaign require a new approval.",
  );
lines.push(
  "",
  "## Cost and execution",
  "",
  `Accounted additional spend: **${money(budgetTotal(ledger.requests))} / $10** across ${ledger.requests.length} underlying API requests and ${ledger.sessions.length}/${ledger.maxSessions} started sessions.`,
  "",
  `Returned request billing totals ${money(ledger.requests.reduce((sum, request) => sum + (request.costUsd ?? 0), 0))}; requests without a known returned charge retain ${money(budgetTotal(ledger.requests.filter((request) => request.costUsd === undefined)))} in reservations. Retained reservations are conservative budget charges, not proof those amounts were billed.`,
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
  "| Fixture | Repetition | Original findings | Peer accepted | Rejected | Uncertain | Combined findings | Accounted pipeline cost |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
);
for (const result of ledger.combined) {
  const dispositions = result.dispositions;
  const sessionIds = new Set(
    ledger.sessions
      .filter(
        (session) =>
          session.pull === result.pull &&
          session.repetition === result.repetition,
      )
      .map((session) => session.id),
  );
  const pipelineCost = budgetTotal(
    ledger.requests.filter((request) => sessionIds.has(request.session)),
  );
  lines.push(
    `| #${result.pull} | ${result.repetition} | ${dispositions.length} | ${dispositions.filter((a) => a.verdict === "accept").length} | ${dispositions.filter((a) => a.verdict === "reject").length} | ${dispositions.filter((a) => a.verdict === "uncertain").length} | ${result.review.findings.length} | ${money(pipelineCost)} |`,
  );
}
lines.push(
  "",
  "Per-pair pipeline cost includes both reviewers, both critics, and any recorded failed/replacement attempts for that fixture and repetition. Costs of unavailable pairs remain in the campaign and stage totals.",
);
const unavailable = ledger.fixtures.flatMap((fixture) =>
  Array.from({ length: ledger.repetitions }, (_, index) => index + 1)
    .filter(
      (repetition) =>
        !ledger.combined.some(
          (result) =>
            result.pull === fixture.pull && result.repetition === repetition,
        ),
    )
    .map((repetition) => `#${fixture.pull} repetition ${repetition}`),
);
if (unavailable.length)
  lines.push(
    "",
    `Combined output unavailable for: ${unavailable.join("; ")}. Every pair requires both independent reviews and both critiques; no partial pair is substituted or scored as zero defects. See the operational records below.`,
  );
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
  "### Concrete examples",
  "",
  "- Schema #354, repetition 1: GLM rejected Kimi's proposed missing installed-part index because the migration already creates it, and rejected the claimed cross-product choice hole because a composite foreign key already prevents it.",
  "- Schema #354, repetition 2: GLM removed the false RLS precedent and already-configured ORM-relation findings. It also rejected an overstated recursive-validation performance finding, losing its real but unmeasured write-cost concern.",
  "- Queue #403, repetition 3: Kimi accepted GLM's claim that Redis commands buffer forever after reconnection stops. The pinned ioredis implementation instead closes and flushes the queued commands. Agreement retained a material error.",
  "- Filtering applies to findings, not inherited summaries or diagrams. Schema cardinality errors and unsupported topology can therefore survive even when the accepted findings are accurate. The combined review is assessed as a whole, not declared correct because the critics agreed.",
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
          `- ${session.id}: ${session.status}${session.error ? ` — ${session.error.replaceAll("\n", " ")}` : ""}${session.validationDetail ? ` (${session.validationDetail.replaceAll("\n", " ")})` : ""}`,
      )
    : ["None recorded."]),
);
if (failures.some((session) => session.stage === "critique"))
  lines.push(
    "",
    "Failed critique finals are unavailable. Their parsing/timeout records establish unavailable structured output, not a factual-quality assessment or a proven model-only cause. No paid replay or silent JSON repair was used for these failures.",
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
