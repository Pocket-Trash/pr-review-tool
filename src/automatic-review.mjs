import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveAutomaticEvent } from "./events.mjs";
import { buildArtifact, collectInternalReviewContext } from "./intake.mjs";
import { runRestrictedReview } from "./opencode.mjs";
import { renderReview } from "./review.mjs";

const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const identity = resolveAutomaticEvent(event);
if (!identity.shouldRun) {
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `Review skipped: ${identity.reason}\n`,
    );
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, "reviewed=false\n");
  process.exit(0);
}

const context = await collectInternalReviewContext(
  identity,
  process.env.REVIEW_CONFIG_PATH,
  process.env.GITHUB_TOKEN,
);
const workspace = await mkdtemp(join(tmpdir(), "pr-review-workspace-"));
try {
  await writeFile(
    join(workspace, "pull-request.json"),
    `${JSON.stringify({ identity, files: context.files }, null, 2)}\n`,
  );
  const review = await runRestrictedReview({
    apiKey: process.env.CHEAPER_INFERENCE_API_KEY,
    model: context.config.model,
    workspace,
  });
  const run = {
    reviewedSha: identity.headSha,
    runId: process.env.GITHUB_RUN_ID,
    selectedSkills: ["review-coordinator", "i-have-adhd", "stop-slop"],
    usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
  };
  const markdown = renderReview(context.config, review, run);
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
  await writeFile(
    process.env.REVIEW_ARTIFACT_PATH,
    buildArtifact({
      review,
      run,
      selectedSkills: run.selectedSkills,
      omissions: [],
      diagnostics: ["OpenCode event-level token usage is not yet available."],
    }),
  );
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, "reviewed=true\n");
} finally {
  await rm(workspace, { recursive: true, force: true });
}
