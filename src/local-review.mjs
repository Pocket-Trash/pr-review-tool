import { readFile } from "node:fs/promises";
import { runRestrictedReview } from "./opencode.mjs";
import {
  renderReview,
  validateProductionRoute,
  validateRun,
} from "./review.mjs";

const [configPath, workspace, runPath] = process.argv.slice(2);
if (!configPath || !workspace || !runPath) {
  throw new TypeError(
    "usage: node src/local-review.mjs <config.json> <workspace> <run.json>",
  );
}

const config = validateProductionRoute(
  JSON.parse(await readFile(configPath, "utf8")),
);
const run = validateRun(JSON.parse(await readFile(runPath, "utf8")));
const review = await runRestrictedReview({
  apiKey: process.env.CHEAPER_INFERENCE_API_KEY,
  provider: config.provider,
  model: config.model,
  skills: config.skills,
  prompt: config.prompt,
  workspace,
});
process.stdout.write(renderReview(config, review, run));
