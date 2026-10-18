import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dispatcher = await readFile(
  new URL("../.github/workflows/review.yml", import.meta.url),
  "utf8",
);
const workflow = await readFile(
  new URL("../.github/workflows/run-review.yml", import.meta.url),
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

test("only an authorized event enters per-pull-request concurrency", () => {
  assert.doesNotMatch(dispatcher, /concurrency:/);
  assert.match(dispatcher, /if: needs\.authorize\.outputs\.runnable == 'true'/);
  assert.match(dispatcher, /uses: \.\/\.github\/workflows\/run-review\.yml/);
  const calledReview = dispatcher.slice(dispatcher.indexOf("\n  review:\n"));
  assert.match(calledReview, /permissions:\s+actions: read/);
  const jobs = workflow.indexOf("\njobs:\n");
  assert.match(
    workflow.slice(0, jobs),
    /concurrency:[\s\S]*group: pr-review-.*inputs\.pull-number[\s\S]*cancel-in-progress: true/,
  );
  assert.doesNotMatch(workflow.slice(jobs), /\n\s+concurrency:/);
});

test("manual and automatic events share resolved artifact and publication identity", () => {
  assert.match(dispatcher, /steps\.authorize\.outputs\.pull-number/);
  assert.match(workflow, /steps\.preflight\.outputs\.pull-number/);
  assert.match(workflow, /steps\.preflight\.outputs\.head-sha/);
  assert.match(workflow, /REVIEW_PULL_NUMBER/);
  assert.match(workflow, /REVIEW_HEAD_SHA/);
});
