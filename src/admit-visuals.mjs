import { appendFile, readFile } from "node:fs/promises";
import { admitVisualRun } from "./visual-admission.mjs";

if (process.env.REVIEW_TASK !== "visuals")
  throw new Error("Visual admission cannot enter another lane");
try {
  const identity = await admitVisualRun({
    event: JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8")),
    token: process.env.GITHUB_APP_TOKEN,
    authenticatedAppSlug: process.env.GITHUB_AUTHENTICATED_APP_SLUG,
    appSlug: process.env.REVIEW_APP_SLUG,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || "1",
    pullNumber: Number(process.env.REVIEW_PULL_NUMBER),
  });
  if (process.env.GITHUB_OUTPUT)
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `runnable=${identity.shouldRun}\n${identity.shouldRun ? `head-sha=${identity.headSha}\n` : ""}`,
    );
  if (!identity.shouldRun && process.env.GITHUB_STEP_SUMMARY)
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `Visual analysis skipped: ${identity.reason}\n`,
    );
  if (identity.acknowledgementWarning && process.env.GITHUB_STEP_SUMMARY)
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `${identity.acknowledgementWarning}\n`,
    );
} catch (error) {
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      "Visual request failed before inference. The pending comment could not be admitted; inspect this run's logs for the GitHub error. No model analysis started.\n",
    );
  throw error;
}
