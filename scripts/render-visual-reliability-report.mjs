import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { renderVisualReliabilityReport } from "../src/visual-evaluation.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));
const corrected = process.argv.includes("--corrected");
const prefix = corrected ? "visual-corrected" : "visual-reliability";
const json = async (name) =>
  JSON.parse(await readFile(join(root, "evaluation", name), "utf8"));
const [base, spec, matrix, assessments] = await Promise.all([
  json("visual-fixtures.json"),
  json(`${prefix}-spec.json`),
  json("matrix.json"),
  json(`${prefix}-assessments.json`),
]);
let ledger;
try {
  ledger = await json(`${prefix}-results.json`);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await writeFile(
  process.argv.slice(2).find((arg) => !arg.startsWith("--")) ??
    join(root, `evaluation/${prefix}-report.md`),
  await renderVisualReliabilityReport(
    ledger,
    { ...base, ...spec },
    matrix.fixtures,
    assessments,
  ),
);
