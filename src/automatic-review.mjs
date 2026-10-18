import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveAutomaticEvent } from "./events.mjs";
import { prepareReviewContext } from "./context.mjs";
import {
  assertCurrentHead,
  buildArtifact,
  collectInternalReviewContext,
  loadChangedFile,
  loadRepositoryFile,
} from "./intake.mjs";
import { runRestrictedReview } from "./opencode.mjs";
import { renderReview, validateProductionRoute } from "./review.mjs";
import { visualPrompt, visualRequirements } from "./visuals.mjs";
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
const identity = resolveAutomaticEvent(event);
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
const prepared = await prepareReviewContext(
  context.files,
  context.config,
  (file) => loadChangedFile(identity, file, process.env.GITHUB_TOKEN),
);
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
const requestedVisuals = visualRequirements(prepared.files);
const skillSelection = selectRelevantSkills({
  manifest: skillManifest,
  installed: await discoverInstalledSkills(join(reviewerRoot, "skills")),
  files: [...prepared.files, ...packageEvidence],
  configured: context.config.skills,
  failed: await loadSkillInstallFailures(
    join(reviewerRoot, "skills/install-status.json"),
  ),
});
const baseRun = {
  reviewedSha: identity.headSha,
  runId: process.env.GITHUB_RUN_ID,
  selectedSkills: skillSelection.selected,
  skillOverrides: skillSelection.overrides,
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
if (prepared.conclusion === "neutral") {
  await assertCurrentHead(identity, process.env.GITHUB_TOKEN);
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `Review skipped: ${prepared.reason}\n`,
    );
  await writeFile(
    process.env.REVIEW_ARTIFACT_PATH,
    buildArtifact({
      conclusion: "neutral",
      config: context.config,
      review: null,
      run: baseRun,
      selectedSkills: skillSelection.selected,
      omissions: prepared.omissions,
      diagnostics: [prepared.reason, ...skillSelection.overrides],
    }),
  );
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, "reviewed=true\n");
  process.exit(0);
}
const workspace = await mkdtemp(join(tmpdir(), "pr-review-workspace-"));
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
    `${JSON.stringify({ identity, pull: context.pull, files: prepared.files, packageEvidence: summarizePackageEvidence(packageEvidence, { maxBytes: packageEvidenceBudget }), omissions: prepared.omissions }, null, 2)}\n`,
  );
  let effectiveSkills = skillSelection.selected;
  const effectiveUsage = { ...baseRun.usage };
  let invocationCount = 0;
  let usageReports = 0;
  const review = await runRestrictedReview({
    apiKey: process.env.CHEAPER_INFERENCE_API_KEY,
    provider: context.config.provider,
    model: context.config.model,
    skills: skillSelection.selected,
    prompt: `${context.config.prompt}\nRepository evidence and installed package versions override conflicting skill advice.\n${visualPrompt(requestedVisuals)}`,
    workspace,
    visualRequirements: requestedVisuals,
    onSkillsResolved: (skills) => {
      effectiveSkills = skills;
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
      effectiveUsage.estimatedCostUsd += usage.estimatedCostUsd;
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
      review,
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
} finally {
  await rm(workspace, { recursive: true, force: true });
}
