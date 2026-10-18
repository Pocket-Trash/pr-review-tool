import { readFile, writeFile } from "node:fs/promises";

const [outcome, errorPath, artifactPath] = process.argv.slice(2);
if (!outcome || !errorPath || !artifactPath)
  throw new TypeError(
    "usage: node src/analysis-status.mjs <outcome> <error.log> <artifact.json>",
  );
if (outcome === "success") process.exit(0);
let rawDetail = "";
try {
  rawDetail = (await readFile(errorPath, "utf8")).trim().slice(-4_000);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const conclusion = /timed out|ETIMEDOUT/i.test(rawDetail)
  ? "timed_out"
  : "failure";
const detail =
  conclusion === "timed_out"
    ? "Review analysis timed out. Inspect the protected workflow logs for details."
    : "Review analysis failed. Inspect the protected workflow logs for details.";
await writeFile(
  artifactPath,
  `${JSON.stringify({ conclusion, diagnostics: [detail] }, null, 2)}\n`,
  { mode: 0o600 },
);
