import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveReviewEvent } from "./events.mjs";
import { prepareReviewContext } from "./context.mjs";
import {
  assertCurrentHead,
  buildArtifact,
  collectInternalReviewContext,
  loadChangedFile,
  loadBaseEvidence,
  loadRepositoryFile,
} from "./intake.mjs";
import { runRestrictedReview } from "./opencode.mjs";
import {
  renderReview,
  validateProductionRoute,
  validateTask,
  validateVisualPhase,
} from "./review.mjs";
import {
  visualPrompt,
  preparedVisualRequirements,
  visualRequirements,
  visualSkipReason,
  visualBaseCandidates,
} from "./visuals.mjs";
import {
  discoverInstalledSkills,
  filterSkillOverrides,
  loadSkillInstallFailures,
  packageManifestPaths,
  selectRelevantSkills,
  summarizePackageEvidence,
} from "./skills.mjs";

const reviewerRoot = fileURLToPath(new URL("..", import.meta.url));
const skillManifest = JSON.parse(
  await readFile(join(reviewerRoot, "skills/manifest.json"), "utf8"),
);

const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const task = process.env.REVIEW_TASK;
const identity =
  task === "review" && process.env.REVIEW_CODE_ENABLED !== "true"
    ? {
        shouldRun: false,
        reason: "review-only lane is not activated in this workflow",
      }
    : await resolveReviewEvent(
        event,
        process.env.GITHUB_TOKEN,
        globalThis.fetch,
        task,
      );
if (!identity.shouldRun) {
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `Review skipped: ${identity.reason}\n`,
    );
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, "reviewed=false\n");
  process.exit(0);
}

const context = await collectInternalReviewContext(
  identity,
  process.env.REVIEW_CONFIG_PATH,
  process.env.GITHUB_TOKEN,
);
validateProductionRoute(context.config);
if (task === "review" && context.config.task !== "review")
  throw new TypeError(
    "review-only workflow requires explicit review configuration",
  );
if (
  context.config.task === "review" &&
  process.env.REVIEW_CODE_ENABLED !== "true"
)
  throw new TypeError("review-only lane is not activated in this workflow");
if (
  validateVisualPhase(context.config.visualPhase) >
  validateVisualPhase(Number(process.env.REVIEW_VISUAL_PHASE || 1))
)
  throw new TypeError("visual phase is not activated in this workflow");
if (task && validateTask(context.config.task) !== validateTask(task))
  throw new TypeError(
    "trusted configuration task does not match the workflow lane",
  );
const prepared = await prepareReviewContext(
  context.files,
  context.config,
  (file) => loadChangedFile(identity, file, process.env.GITHUB_TOKEN),
);
if (context.config.visualPhase === 2) {
  for (const file of visualBaseCandidates(prepared.files)) {
    const evidence = await loadBaseEvidence(
      identity,
      file,
      process.env.GITHUB_TOKEN,
      context.config.limits.maxFileBytes,
    );
    if (evidence) Object.assign(file, evidence);
    else
      prepared.omissions.push(
        `${file.filename}: frozen base content unavailable; before/after views and removed dependency edges were not inferred.`,
      );
  }
}
let requestedVisuals;
let scopeFailure;
if (context.config.task === "visuals") {
  try {
    requestedVisuals = preparedVisualRequirements(
      prepared,
      context.config.visualPhase,
    );
  } catch (error) {
    scopeFailure = error.message;
  }
} else if (context.config.task !== "review") {
  requestedVisuals = visualRequirements(
    prepared.files,
    context.config.visualPhase,
  );
}
const skipReason =
  scopeFailure ??
  (prepared.conclusion === "neutral"
    ? prepared.reason
    : context.config.task === "visuals"
      ? visualSkipReason(requestedVisuals)
      : context.config.task === "review" && prepared.files.length === 0
        ? "No reviewable files remain after trusted exclusions; inference was skipped."
        : null);
const baseRun = {
  reviewedSha: identity.headSha,
  runId: process.env.GITHUB_RUN_ID,
  selectedSkills: [],
  skillOverrides: [],
  usage: {
    inputTokens: 0,
    cachedInputTokens: null,
    reasoningTokens: null,
    outputTokens: 0,
    modelCalls: 0,
    toolIterations: 0,
    estimatedCostUsd: 0,
  },
};
if (skipReason) {
  await assertCurrentHead(identity, process.env.GITHUB_TOKEN);
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `${context.config.task === "visuals" ? "PR Visuals" : "Review"} ${scopeFailure ? "failed before inference" : "skipped"}: ${skipReason}\n`,
    );
  await writeFile(
    process.env.REVIEW_ARTIFACT_PATH,
    buildArtifact({
      task: context.config.task,
      conclusion: scopeFailure ? "failure" : "neutral",
      config: context.config,
      review: null,
      run: baseRun,
      selectedSkills: [],
      omissions: prepared.omissions,
      diagnostics: [skipReason],
    }),
  );
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, "reviewed=true\n");
  process.exit(scopeFailure ? 1 : 0);
}
const packageEvidence = (
  await Promise.all(
    packageManifestPaths(prepared.files).map((path) =>
      loadRepositoryFile(
        identity,
        path,
        process.env.GITHUB_TOKEN,
        globalThis.fetch,
        context.config.limits.maxFileBytes,
      ),
    ),
  )
).filter(Boolean);
const skillSelection = selectRelevantSkills({
  task: context.config.task,
  manifest: skillManifest,
  installed: await discoverInstalledSkills(join(reviewerRoot, "skills")),
  files: [...prepared.files, ...packageEvidence],
  configured: context.config.skills,
  failed: await loadSkillInstallFailures(
    join(reviewerRoot, "skills/install-status.json"),
  ),
});
baseRun.selectedSkills = skillSelection.selected;
baseRun.skillOverrides = skillSelection.overrides;
const workspace = await mkdtemp(join(tmpdir(), "pr-review-workspace-"));
let visualValidation;
let evidenceReport;
try {
  const packageEvidenceBudget = Math.min(
    64 * 1024,
    Math.max(
      0,
      context.config.limits.maxBytes -
        Buffer.byteLength(JSON.stringify(prepared.files)),
    ),
  );
  await writeFile(
    join(workspace, "pull-request.json"),
    `${JSON.stringify({ identity, pull: context.pull, files: prepared.files, eligibilityFiles: prepared.eligibilityFiles, packageEvidence: summarizePackageEvidence(packageEvidence, { maxBytes: packageEvidenceBudget }), omissions: prepared.omissions }, null, 2)}\n`,
  );
  let effectiveSkills = skillSelection.selected;
  const effectiveUsage = { ...baseRun.usage };
  let invocationCount = 0;
  let usageReports = 0;
  const review = await runRestrictedReview({
    task: context.config.task,
    reviewOnly: context.config.task === "review",
    visualPhase: context.config.visualPhase,
    apiKey:
      context.config.provider === "openrouter"
        ? process.env.OPENROUTER_API_KEY
        : process.env.CHEAPER_INFERENCE_API_KEY,
    provider: context.config.provider,
    model: context.config.model,
    skills: skillSelection.selected,
    prompt: `${context.config.prompt}\nRepository evidence and installed package versions override conflicting skill advice.${context.config.task === "review" ? "" : `\n${visualPrompt(requestedVisuals)}`}`,
    workspace,
    visualRequirements: requestedVisuals,
    onSkillsResolved: (skills) => {
      effectiveSkills = skills;
    },
    onEvidence: (report) => {
      evidenceReport = report;
    },
    onVisualValidation: (report) => {
      visualValidation = report;
    },
    onUsage: (usage) => {
      usageReports += 1;
      effectiveUsage.inputTokens += usage.inputTokens;
      for (const field of ["cachedInputTokens", "reasoningTokens"])
        if (usage[field] !== null)
          effectiveUsage[field] = (effectiveUsage[field] ?? 0) + usage[field];
      effectiveUsage.outputTokens += usage.outputTokens;
      effectiveUsage.modelCalls += usage.modelCalls;
      effectiveUsage.toolIterations += usage.toolIterations;
      effectiveUsage.estimatedCostUsd =
        effectiveUsage.estimatedCostUsd === null ||
        usage.estimatedCostUsd === null
          ? null
          : effectiveUsage.estimatedCostUsd + usage.estimatedCostUsd;
    },
    onInvocation: () => {
      invocationCount += 1;
    },
  });
  await assertCurrentHead(identity, process.env.GITHUB_TOKEN);
  review.coverageGaps.push(
    ...prepared.omissions,
    ...skillSelection.coverageGaps,
  );
  if (usageReports < invocationCount) effectiveUsage.estimatedCostUsd = null;
  if (effectiveUsage.estimatedCostUsd === null)
    review.coverageGaps.push(
      "Complete inference cost metadata was unavailable; total cost is unknown.",
    );
  if (usageReports < invocationCount)
    review.coverageGaps.push(
      `${invocationCount - usageReports} model invocation(s) did not expose usage metadata; recorded usage is a lower bound.`,
    );
  const effectiveOverrides = filterSkillOverrides(
    skillSelection.overrides,
    effectiveSkills,
  );
  const run = {
    ...baseRun,
    selectedSkills: effectiveSkills,
    skillOverrides: effectiveOverrides,
    usage: effectiveUsage,
  };
  const markdown = renderReview(context.config, review, run);
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
  await writeFile(
    process.env.REVIEW_ARTIFACT_PATH,
    buildArtifact({
      conclusion: "success",
      config: context.config,
      task: context.config.task,
      review,
      evidence: evidenceReport,
      visualRequirements:
        context.config.task === "visuals" ? requestedVisuals : undefined,
      visualValidation,
      run,
      selectedSkills: run.selectedSkills,
      omissions: prepared.omissions,
      diagnostics: [
        ...effectiveOverrides,
        ...(usageReports < invocationCount
          ? ["One or more model invocations had unknown metering."]
          : []),
      ],
    }),
  );
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, "reviewed=true\n");
} catch (error) {
  await writeFile(
    process.env.REVIEW_ARTIFACT_PATH,
    buildArtifact({
      conclusion: /timed out/i.test(error.message) ? "timed_out" : "failure",
      config: context.config,
      task: context.config.task,
      visualRequirements:
        context.config.task === "visuals" ? requestedVisuals : undefined,
      visualValidation,
      evidence: evidenceReport,
      diagnostics: [
        error.code === "VISUAL_REQUIRED_MISSING"
          ? error.message
          : "Analysis failed; inspect protected workflow logs.",
      ],
    }),
  );
  throw error;
} finally {
  await rm(workspace, { recursive: true, force: true });
}
