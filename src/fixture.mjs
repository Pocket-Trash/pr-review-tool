import { readFile } from "node:fs/promises";
import { renderReview, validateConfig } from "./review.mjs";

const [configPath, reviewPath, runPath] = process.argv.slice(2);
if (!configPath || !reviewPath || !runPath) {
  throw new TypeError(
    "usage: node src/fixture.mjs <config.json> <review.json> <run.json>",
  );
}

const config = validateConfig(JSON.parse(await readFile(configPath, "utf8")));
const review = JSON.parse(await readFile(reviewPath, "utf8"));
const run = JSON.parse(await readFile(runPath, "utf8"));
process.stdout.write(renderReview(config, review, run));
