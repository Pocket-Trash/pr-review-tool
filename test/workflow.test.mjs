import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(
  new URL("../.github/workflows/review.yml", import.meta.url),
  "utf8",
);

test("publisher isolates the model key from the minimum-permission App token", () => {
  const publishJob = workflow.slice(workflow.lastIndexOf("\n  publish:\n"));
  assert.doesNotMatch(publishJob, /CHEAPER_INFERENCE_API_KEY/);
  for (const permission of [
    "permission-metadata: read",
    "permission-contents: read",
    "permission-pull-requests: read",
    "permission-checks: write",
    "permission-issues: write",
  ])
    assert.match(publishJob, new RegExp(permission));
  assert.doesNotMatch(
    publishJob,
    /permission-(?:administration|workflows):\s*write/,
  );
  assert.match(publishJob, /if: always\(\)/);
});

test("the entire review workflow is serialized per pull request", () => {
  const jobs = workflow.indexOf("\njobs:\n");
  const workflowSettings = workflow.slice(0, jobs);
  assert.match(
    workflowSettings,
    /concurrency:[\s\S]*group: pr-review-.*pull_request\.number[\s\S]*cancel-in-progress: true/,
  );
  assert.doesNotMatch(workflow.slice(jobs), /\n\s+concurrency:/);
});
