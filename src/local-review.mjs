import { readFile } from "node:fs/promises";
import { runRestrictedReview } from "./opencode.mjs";
import { renderReview, validateConfig, validateRun } from "./review.mjs";

const [configPath, workspace, runPath] = process.argv.slice(2);
if (!configPath || !workspace || !runPath) {
  throw new TypeError(
    "usage: node src/local-review.mjs <config.json> <workspace> <run.json>",
  );
}

const config = validateConfig(JSON.parse(await readFile(configPath, "utf8")));
if (config.provider !== "cheaperinference")
  throw new TypeError("local review requires the cheaperinference provider");
const run = validateRun(JSON.parse(await readFile(runPath, "utf8")));
const review = await runRestrictedReview({
  apiKey: process.env.CHEAPER_INFERENCE_API_KEY,
  model: config.model,
  workspace,
});
process.stdout.write(renderReview(config, review, run));
