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
    "permission-pull-requests: write",
    "permission-checks: write",
    "permission-issues: write",
  ])
    assert.match(publishJob, new RegExp(permission));
  assert.doesNotMatch(
    publishJob,
    /permission-(?:administration|workflows):\s*write/,
  );
  assert.match(publishJob, /if: always\(\)/);
  assert.match(
    publishJob,
    /working-directory: reviewer\s+run: npm ci --ignore-scripts/,
  );
  assert.ok(
    publishJob.indexOf("npm ci --ignore-scripts") <
      publishJob.indexOf("infisical.mjs publication"),
  );
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
    /concurrency:[\s\S]*group: pr-\$\{\{ inputs\.task \}\}-.*inputs\.pull-number[\s\S]*cancel-in-progress: true/,
  );
  assert.doesNotMatch(workflow.slice(jobs), /\n\s+concurrency:/);
});

test("workflows default to Phase 1 visuals and keep review activation disabled", () => {
  for (const yaml of [dispatcher, workflow])
    assert.match(yaml, /REVIEW_TASK: \$\{\{ inputs\.task \}\}/);
  for (const yaml of [dispatcher, workflow]) {
    assert.match(yaml, /default: visuals/);
    assert.match(yaml, /REVIEW_CODE_ENABLED: "false"/);
  }
  for (const yaml of [dispatcher, workflow])
    assert.match(yaml, /REVIEW_VISUAL_PHASE: "1"/);
  assert.match(
    dispatcher,
    /inputs\.task == 'review'.*\.github\/pr-review\.json.*\.github\/pr-visuals\.json/,
  );
  assert.equal(
    (workflow.match(/name: pr-\$\{\{ inputs\.task \}\}-/g) || []).length,
    2,
  );
  assert.match(workflow, /REVIEW_ARTIFACT_LIMIT_BYTES: "524288"/);
  assert.match(
    workflow,
    /inputs\.task != 'review' \|\| needs\.review\.outputs\.review-enabled == 'true'/,
  );
  assert.match(workflow, /retention-days: 90/);
});

test("manual and automatic events share resolved artifact and publication identity", () => {
  assert.match(dispatcher, /steps\.authorize\.outputs\.pull-number/);
  assert.match(workflow, /steps\.preflight\.outputs\.pull-number/);
  assert.match(workflow, /steps\.preflight\.outputs\.head-sha/);
  assert.match(workflow, /REVIEW_PULL_NUMBER/);
  assert.match(workflow, /REVIEW_HEAD_SHA/);
});

test("OIDC fetches only the job credential after authorization without changing routing", () => {
  const reviewJob = workflow.slice(
    workflow.indexOf("\n  review:\n"),
    workflow.lastIndexOf("\n  publish:\n"),
  );
  const publishJob = workflow.slice(workflow.lastIndexOf("\n  publish:\n"));
  assert.match(reviewJob, /id-token: write/);
  assert.match(publishJob, /id-token: write/);
  assert.match(reviewJob, /node reviewer\/src\/infisical.mjs analysis/);
  assert.doesNotMatch(reviewJob, /APP_PRIVATE_KEY|infisical.mjs publication/);
  assert.match(publishJob, /node reviewer\/src\/infisical.mjs publication/);
  assert.doesNotMatch(
    publishJob,
    /infisical.mjs analysis|CHEAPERINFERENCE|OPENROUTER/,
  );
  assert.match(reviewJob, /steps\.model-credential\.outcome != 'failure'/);
  assert.match(
    reviewJob,
    /Preserve analysis failure state[\s\S]*steps\.model-credential\.outcome == 'failure'/,
  );
  const fetchStep = reviewJob.slice(
    reviewJob.indexOf("- id: model-credential"),
    reviewJob.indexOf("- id: review"),
  );
  assert.match(fetchStep, /steps\.preflight\.outcome == 'success'/);
  assert.match(fetchStep, /steps\.preflight\.outputs\.runnable == 'true'/);
  const authorizeJob = dispatcher.slice(
    dispatcher.indexOf("\n  authorize:\n"),
    dispatcher.indexOf("\n  review:\n"),
  );
  assert.doesNotMatch(authorizeJob, /id-token: write|INFISICAL_/);
  assert.match(
    dispatcher,
    /infisical-project-id: \$\{\{ inputs\.infisical-project-id \}\}/,
  );
});

test("visual admission claims before analysis using an isolated App token and frozen head", () => {
  const admission = workflow.slice(
    workflow.indexOf("\n  admit:\n"),
    workflow.indexOf("\n  review:\n"),
  );
  assert.match(admission, /if: inputs.task == 'visuals'/);
  assert.match(admission, /infisical.mjs publication/);
  assert.match(admission, /admit-visuals.mjs/);
  assert.match(admission, /permission-pull-requests: write/);
  assert.match(
    admission,
    /permissions:\s+contents: read\s+pull-requests: read/,
  );
  assert.doesNotMatch(
    admission,
    /OPENROUTER|CHEAPER_INFERENCE|infisical.mjs analysis|npm ci|skills:install/,
  );
  assert.match(workflow, /needs: admit/);
  assert.match(workflow, /needs.admit.outputs.runnable == 'true'/);
  assert.match(
    workflow,
    /REVIEW_ADMITTED_HEAD_SHA: \$\{\{ needs.admit.outputs.head-sha \}\}/,
  );
  assert.match(workflow, /head-sha:.*needs.admit.outputs.head-sha/);
  assert.match(dispatcher, /REVIEW_APP_SLUG: \$\{\{ inputs.app-slug \}\}/);
});
