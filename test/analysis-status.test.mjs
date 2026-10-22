import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("analysis failure artifacts never contain raw stderr", async () => {
  const directory = await mkdtemp(join(tmpdir(), "analysis-status-"));
  const errorPath = join(directory, "error.log");
  const artifactPath = join(directory, "artifact.json");
  const secret = "secret-value-that-must-not-be-published";
  await writeFile(errorPath, `request failed with token ${secret}\n`);
  await execFileAsync(process.execPath, [
    new URL("../src/analysis-status.mjs", import.meta.url).pathname,
    "failure",
    errorPath,
    artifactPath,
  ]);
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  assert.equal(artifact.conclusion, "failure");
  assert.doesNotMatch(JSON.stringify(artifact), new RegExp(secret));
  assert.deepEqual(artifact.diagnostics, [
    "Review analysis failed. Inspect the protected workflow logs for details.",
  ]);
  const structured = {
    ...artifact,
    visualValidation: {
      version: "visual-validation-v1",
      attempts: [{ attempt: 0, missing: ["architecture"] }],
    },
  };
  await writeFile(artifactPath, JSON.stringify(structured));
  await execFileAsync(process.execPath, [
    new URL("../src/analysis-status.mjs", import.meta.url).pathname,
    "failure",
    errorPath,
    artifactPath,
  ]);
  assert.deepEqual(
    JSON.parse(await readFile(artifactPath, "utf8")),
    structured,
  );
});
