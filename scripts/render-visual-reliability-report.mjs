import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { renderVisualReliabilityReport } from "../src/visual-evaluation.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));
const json = async (name) =>
  JSON.parse(await readFile(join(root, "evaluation", name), "utf8"));
const [base, spec, matrix, assessments] = await Promise.all([
  json("visual-fixtures.json"),
  json("visual-reliability-spec.json"),
  json("matrix.json"),
  json("visual-reliability-assessments.json"),
]);
let ledger;
try {
  ledger = await json("visual-reliability-results.json");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await writeFile(
  process.argv[2] ?? join(root, "evaluation/visual-reliability-report.md"),
  await renderVisualReliabilityReport(
    ledger,
    { ...base, ...spec },
    matrix.fixtures,
    assessments,
  ),
);
