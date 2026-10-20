import { appendFile, readFile } from "node:fs/promises";
import { resolveReviewEvent } from "./events.mjs";
import { collectInternalReviewContext } from "./intake.mjs";
import {
  validateProductionRoute,
  validateTask,
  validateVisualPhase,
} from "./review.mjs";

const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const task = validateTask(process.env.REVIEW_TASK);
let provider;
const identity =
  process.env.REVIEW_TASK === "review" &&
  process.env.REVIEW_CODE_ENABLED !== "true"
    ? {
        shouldRun: false,
        reason: "review-only lane is not activated in this workflow",
      }
    : await resolveReviewEvent(
        event,
        process.env.GITHUB_TOKEN,
        globalThis.fetch,
        task,
      );

if (identity.shouldRun && process.env.REVIEW_AUTHORIZE_ONLY !== "true") {
  const context = await collectInternalReviewContext(
    identity,
    process.env.REVIEW_CONFIG_PATH,
    process.env.GITHUB_TOKEN,
  );
  validateProductionRoute(context.config);
  if (task === "review" && context.config.task !== "review")
    throw new TypeError(
      "review-only workflow requires explicit review configuration",
    );
  if (
    validateVisualPhase(context.config.visualPhase) >
    validateVisualPhase(Number(process.env.REVIEW_VISUAL_PHASE || 1))
  )
    throw new TypeError("visual phase is not activated in this workflow");
  if (validateTask(context.config.task) !== task)
    throw new TypeError(
      "trusted configuration task does not match the workflow lane",
    );
  provider = context.config.provider;
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
  if (provider)
    await appendFile(process.env.GITHUB_OUTPUT, `provider=${provider}\n`);
}
if (!identity.shouldRun && process.env.GITHUB_STEP_SUMMARY)
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `Review skipped: ${identity.reason}\n`,
  );
