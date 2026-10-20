import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  evaluateReviewTrial,
  inspectHistoricalReview,
} from "../src/review-evaluation.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const json = async (name) =>
  JSON.parse(await readFile(join(root, "evaluation", name), "utf8"));
const [matrix, spec, assessments, original, peers, prior, peerPrior] =
  await Promise.all(
    [
      "matrix.json",
      "review-fixtures.json",
      "review-assessments.json",
      "results.json",
      "peer-results.json",
      "adjudication.json",
      "peer-adjudication.json",
    ].map(json),
  );
let fresh = { sessions: [] };
try {
  fresh = await json("review-results.json");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const lines = [
  "# Phase 3 review-only evaluation",
  "",
  "No dedicated review-only inference has run. No production route/model/failover is selected. Fresh paid evaluation requires a separate approved dollar/session/request cap; historical campaign ledgers remain closed.",
  "",
  "## Dedicated review gate",
  "",
  "Each candidate must complete all three frozen PRs three times with the strict four-key review-only contract and source assessment: no material false claims or false blockers, accurate coverage/generated-artifact omissions, held denied-tool boundaries, stable telemetry, full tool loop, complete request billing and at most 15 minutes. Expected-fact recall is not overall accuracy. Missing, failed and unassessed output is unavailable, never perfect or zero defects. Diagrams are excluded. Peer critique is optional and requires its own assessed evidence, not agreement-based truth.",
  "",
  "<!-- prettier-ignore -->",
  "| Session | Result | Assessed | Review pass |",
  "| --- | --- | --- | --- |",
];
if (!fresh.sessions.length)
  lines.push("| No fresh sessions | awaiting approval | N/A | N/A |");
for (const row of fresh.sessions) {
  const source = matrix.fixtures.find((fixture) => fixture.pull === row.pull);
  if (!source || !spec.fixtures.some((fixture) => fixture.pull === row.pull))
    throw new TypeError("unknown review fixture");
  const requests = (fresh.requests ?? []).filter(
    (request) => request.session === row.id,
  );
  const complete =
    requests.length > 0 &&
    requests.every(
      (request) =>
        request.status === "complete" &&
        Number.isFinite(request.costUsd) &&
        request.costUsd >= 0 &&
        !request.boundExceeded,
    );
  const result = evaluateReviewTrial(
    { ...row, billingStatus: complete ? "complete" : "unconfirmed" },
    source,
    assessments.runs[row.id],
  );
  lines.push(
    `| ${row.id} | ${result.status} | ${result.assessed ? "yes" : "no"} | ${result.passes ? "yes" : "no"} |`,
  );
}
lines.push("", "## Source-grounded regression checks", "");
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
  "## Historical evidence only",
  "",
  "These combined-task outputs cannot become dedicated review-only completions. False-claim counts below are prior whole-output assessments, possibly including descriptive/diagram claims; they are not relabeled as finding-only verdicts. Prior diagram quality and whole-task pass/fail do not decide the new review gate. Historical costs/latencies remain in the original reports and are not quoted as review-only measurements. Unassessed claim counts are N/A, not zero.",
  "",
  "<!-- prettier-ignore -->",
  "| Attempt | Evidence status | Findings | Prior whole-output false claims / blockers |",
  "| --- | --- | ---: | --- |",
);
const histories = [
  ...original.runs.map((row) => ({ row, assessment: prior.runs[row.id] })),
  ...peers.sessions
    .filter((row) => row.stage === "independent")
    .map((row) => ({ row, assessment: peerPrior.runs[row.id] })),
];
for (const { row, assessment } of histories) {
  const inspected = inspectHistoricalReview(row, assessment);
  lines.push(
    `| ${row.id} | ${inspected.status} | ${inspected.findingCount ?? "N/A"} | ${inspected.wholeOutputFalseClaims ?? "N/A"} / ${inspected.wholeOutputFalseBlockers ?? "N/A"} |`,
  );
}
lines.push(
  "",
  "## Activation gate",
  "",
  "Keep review execution disabled. Record exact available provider/model/failover, current prices, a fresh approved cap and durable per-request reservations before paid inference. Source-adjudicate every completion and publish task-specific completion, latency and cost separately from diagrams. Owner approval and live dual-lane adoption/authorization/failure checks remain required; this offline report cannot activate or run inference.",
  "",
);
await writeFile(
  process.argv[2] || join(root, "evaluation/review-report.md"),
  lines.join("\n"),
);
