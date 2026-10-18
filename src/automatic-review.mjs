import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveAutomaticEvent } from "./events.mjs";
import { prepareReviewContext } from "./context.mjs";
import {
  assertCurrentHead,
  buildArtifact,
  collectInternalReviewContext,
  loadChangedFile,
} from "./intake.mjs";
import { REVIEW_SKILLS, runRestrictedReview } from "./opencode.mjs";
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
const prepared = await prepareReviewContext(
  context.files,
  context.config,
  (file) => loadChangedFile(identity, file, process.env.GITHUB_TOKEN),
);
const baseRun = {
  reviewedSha: identity.headSha,
  runId: process.env.GITHUB_RUN_ID,
  selectedSkills: REVIEW_SKILLS,
  usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
};
if (prepared.conclusion === "neutral") {
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `Review skipped: ${prepared.reason}\n`,
    );
  await writeFile(
    process.env.REVIEW_ARTIFACT_PATH,
    buildArtifact({
      review: null,
      run: baseRun,
      selectedSkills: REVIEW_SKILLS,
      omissions: prepared.omissions,
      diagnostics: [prepared.reason],
    }),
  );
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, "reviewed=true\n");
  process.exit(0);
}
const workspace = await mkdtemp(join(tmpdir(), "pr-review-workspace-"));
try {
  await writeFile(
    join(workspace, "pull-request.json"),
    `${JSON.stringify({ identity, pull: context.pull, files: prepared.files, omissions: prepared.omissions }, null, 2)}\n`,
  );
  const review = await runRestrictedReview({
    apiKey: process.env.CHEAPER_INFERENCE_API_KEY,
    model: context.config.model,
    workspace,
  });
  await assertCurrentHead(identity, process.env.GITHUB_TOKEN);
  review.coverageGaps.push(...prepared.omissions);
  const run = baseRun;
  const markdown = renderReview(context.config, review, run);
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
  await writeFile(
    process.env.REVIEW_ARTIFACT_PATH,
    buildArtifact({
      review,
      run,
      selectedSkills: run.selectedSkills,
      omissions: prepared.omissions,
      diagnostics: ["OpenCode event-level token usage is not yet available."],
    }),
  );
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, "reviewed=true\n");
} finally {
  await rm(workspace, { recursive: true, force: true });
}
