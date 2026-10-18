import { appendFile, readFile } from "node:fs/promises";
import { resolveReviewEvent } from "./events.mjs";
import { collectInternalReviewContext } from "./intake.mjs";
import { validateProductionRoute } from "./review.mjs";

const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const identity = await resolveReviewEvent(event, process.env.GITHUB_TOKEN);

if (identity.shouldRun && process.env.REVIEW_AUTHORIZE_ONLY !== "true") {
  const context = await collectInternalReviewContext(
    identity,
    process.env.REVIEW_CONFIG_PATH,
    process.env.GITHUB_TOKEN,
  );
  validateProductionRoute(context.config);
}

if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `runnable=${identity.shouldRun}\n`,
  );
  if (identity.shouldRun)
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `pull-number=${identity.pullNumber}\nhead-sha=${identity.headSha}\n`,
    );
}
if (!identity.shouldRun && process.env.GITHUB_STEP_SUMMARY)
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `Review skipped: ${identity.reason}\n`,
  );
