import { appendFile, readFile } from "node:fs/promises";
import { resolveAutomaticEvent } from "./events.mjs";
import { collectInternalReviewContext } from "./intake.mjs";

const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const identity = resolveAutomaticEvent(event);

if (identity.shouldRun) {
  await collectInternalReviewContext(
    identity,
    process.env.REVIEW_CONFIG_PATH,
    process.env.GITHUB_TOKEN,
  );
}

if (process.env.GITHUB_OUTPUT)
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `runnable=${identity.shouldRun}\n`,
  );
if (!identity.shouldRun && process.env.GITHUB_STEP_SUMMARY)
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `Review skipped: ${identity.reason}\n`,
  );
