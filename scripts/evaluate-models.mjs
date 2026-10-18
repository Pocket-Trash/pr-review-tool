import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runRestrictedReview, REVIEW_SKILLS } from "../src/opencode.mjs";
import { prepareReviewContext } from "../src/context.mjs";
import { loadChangedFile } from "../src/intake.mjs";
import {
  discoverInstalledSkills,
  selectRelevantSkills,
} from "../src/skills.mjs";
import { visualPrompt, visualRequirements } from "../src/visuals.mjs";
import {
  accountedRunCost,
  priceUsage,
  projectedRunCost,
  writeJsonAtomic,
} from "../src/evaluation.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const matrix = JSON.parse(
  await readFile(join(root, "evaluation/matrix.json"), "utf8"),
);
const skillManifest = JSON.parse(
  await readFile(join(root, "skills/manifest.json"), "utf8"),
);
const selectedProvider = process.argv[2] || "all";
const outputPath = process.argv[3] || join(root, "evaluation/results.json");
const catalogOnly = process.env.EVALUATION_CATALOG_ONLY === "1";
if (!["all", "cheaperinference", "openrouter"].includes(selectedProvider))
  throw new TypeError("provider must be all, cheaperinference, or openrouter");
if (
  !catalogOnly &&
  Number(process.env.EVALUATION_BUDGET_USD) !== matrix.budgetUsd
)
  throw new TypeError("EVALUATION_BUDGET_USD must be exactly 10");

const credentials = {
  cheaperinference: process.env.CHEAPER_INFERENCE_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY,
};
const candidates = matrix.candidates.filter(
  ({ provider }) => selectedProvider === "all" || provider === selectedProvider,
);
const installedSkills = new Map([
  ...(await discoverInstalledSkills(join(root, "skills"))),
  ...(await discoverInstalledSkills(join(root, ".agents/skills"))),
]);
for (const name of skillManifest.sources.flatMap(({ skills }) =>
  skills.map((skill) => skill.name),
))
  if (!installedSkills.has(name))
    throw new Error(
      `evaluation skill ${name} is missing; run npm run skills:install first`,
    );
const plannedRuns =
  candidates.length * matrix.fixtures.length * matrix.repetitions;
if (plannedRuns > matrix.maxRuns)
  throw new Error(`evaluation would exceed ${matrix.maxRuns} runs`);
for (const { provider } of candidates)
  if (!catalogOnly && !credentials[provider])
    throw new TypeError(
      `${provider === "openrouter" ? "OPENROUTER_API_KEY" : "CHEAPER_INFERENCE_API_KEY"} is required`,
    );

const headers = { accept: "application/vnd.github+json" };
if (process.env.GITHUB_TOKEN)
  headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub API ${path}: ${response.status}`);
  return response.json();
}

async function catalog(provider) {
  const response = await fetch(
    provider === "cheaperinference"
      ? "https://api.cheaperinference.com/v1/models"
      : "https://openrouter.ai/api/v1/models",
    {
      headers: credentials[provider]
        ? { authorization: `Bearer ${credentials[provider]}` }
        : {},
    },
  );
  if (!response.ok) throw new Error(`${provider} catalog: ${response.status}`);
  return new Map(
    (await response.json()).data.map((model) => [model.id, model]),
  );
}

const modelAvailable = (entry) =>
  typeof entry === "boolean" ? entry : entry?.available === true;

function evaluatedCandidate(candidate) {
  const catalogEntry =
    result.catalogs[candidate.provider]?.models[candidate.model];
  if (candidate.provider !== "openrouter" || !catalogEntry?.pricing)
    return candidate;
  return {
    ...candidate,
    inputPerMillionUsd: catalogEntry.pricing.inputPerMillionUsd,
    outputPerMillionUsd: catalogEntry.pricing.outputPerMillionUsd,
  };
}

async function fixtureContext(fixture) {
  const comparison = await github(
    `/repos/Pocket-Trash/pocket-trash/compare/${fixture.baseSha}...${fixture.headSha}?per_page=100`,
  );
  const files = comparison.files.map(
    ({ filename, status, additions, deletions, patch }) => ({
      filename,
      status,
      additions,
      deletions,
      patch,
    }),
  );
  const identity = {
    repository: "Pocket-Trash/pocket-trash",
    pullNumber: fixture.pull,
    baseSha: fixture.baseSha,
    headSha: fixture.headSha,
  };
  const prepared = await prepareReviewContext(files, matrix.context, (file) =>
    loadChangedFile(identity, file, process.env.GITHUB_TOKEN, globalThis.fetch),
  );
  if (prepared.conclusion !== "review")
    throw new Error(
      `frozen PR #${fixture.pull} is not reviewable: ${prepared.reason}`,
    );
  return {
    identity,
    pull: {
      number: fixture.pull,
      title: fixture.title,
      body: "",
      headSha: fixture.headSha,
    },
    files: prepared.files,
    omissions: prepared.omissions,
  };
}

function signals(review, expectedFacts, requirements) {
  const prose = JSON.stringify(review).toLowerCase();
  const matchedFacts = expectedFacts.map((alternatives) =>
    alternatives.some((fact) => prose.includes(fact.toLowerCase())),
  );
  const requiredKinds = [];
  if (requirements.architecture) requiredKinds.push("architecture");
  if (requirements.schema === "small") requiredKinds.push("schema-er");
  if (requirements.schema === "large")
    requiredKinds.push("schema-domain", "schema-er");
  return {
    expectedFactRecallSignal:
      matchedFacts.filter(Boolean).length / matchedFacts.length,
    matchedFacts,
    blockingFindingsForAdjudication: review.findings.filter(({ severity }) =>
      ["critical", "high"].includes(severity),
    ),
    diagramRequirementsMet:
      requiredKinds.every((kind) =>
        review.diagrams.some((diagram) => diagram.kind === kind),
      ) && review.diagrams.length <= 4,
  };
}

let result = {
  generatedAt: new Date().toISOString(),
  matrix,
  catalogs: {},
  runs: [],
};
try {
  result = JSON.parse(await readFile(outputPath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
result.matrix = matrix;
try {
  const verifiedCatalogs = JSON.parse(
    await readFile(join(root, "evaluation/catalogs.json"), "utf8"),
  );
  result.catalogs = { ...result.catalogs, ...verifiedCatalogs.catalogs };
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

for (const provider of new Set(candidates.map(({ provider }) => provider))) {
  const models = await catalog(provider);
  const expected = candidates
    .filter((candidate) => candidate.provider === provider)
    .map(({ model }) => model);
  result.catalogs[provider] = {
    verifiedAt: new Date().toISOString(),
    authenticated: Boolean(credentials[provider]),
    models: Object.fromEntries(
      expected.map((model) => {
        const entry = models.get(model);
        const pricing =
          provider === "openrouter" && entry?.pricing
            ? {
                inputPerMillionUsd:
                  Math.round(Number(entry.pricing.prompt) * 1_000_000 * 1e6) /
                  1e6,
                outputPerMillionUsd:
                  Math.round(
                    Number(entry.pricing.completion) * 1_000_000 * 1e6,
                  ) / 1e6,
              }
            : undefined;
        return [
          model,
          {
            available: Boolean(entry),
            ...(pricing &&
            Object.values(pricing).every(
              (value) => Number.isFinite(value) && value >= 0,
            )
              ? { pricing }
              : {}),
          },
        ];
      }),
    ),
  };
}
for (const candidate of candidates.filter(
  ({ provider }) => provider === "openrouter",
)) {
  const entry = result.catalogs.openrouter?.models[candidate.model];
  if (modelAvailable(entry) && !entry.pricing)
    throw new Error(
      `OpenRouter catalog did not report current pricing for ${candidate.model}`,
    );
}

await mkdir(join(root, "evaluation"), { recursive: true });
await writeJsonAtomic(outputPath, result);
if (catalogOnly) process.exit(0);
const fixtureContexts = new Map(
  await Promise.all(
    matrix.fixtures.map(async (fixture) => [
      fixture.pull,
      await fixtureContext(fixture),
    ]),
  ),
);
for (const run of result.runs) {
  const candidate = matrix.candidates.find(
    ({ provider, model }) => provider === run.provider && model === run.model,
  );
  if (!candidate) continue;
  if (run.usage) run.usage = priceUsage(run.usage, candidate);
  if (run.error)
    run.reservedCostUsd = Math.max(
      run.reservedCostUsd || 0,
      run.usage?.estimatedCostUsd || 0,
      projectedRunCost(candidate),
    );
  run.status ||= run.error ? "error" : run.review ? "success" : "in-progress";
}
for (const run of result.runs) {
  if (!run.review) continue;
  const fixture = matrix.fixtures.find(({ pull }) => pull === run.pull);
  run.signals = signals(
    run.review,
    fixture.expectedFacts,
    visualRequirements(fixtureContexts.get(run.pull).files),
  );
  delete run.score;
}
await writeJsonAtomic(outputPath, result);
for (const configuredCandidate of candidates) {
  if (
    !modelAvailable(
      result.catalogs[configuredCandidate.provider]?.models[
        configuredCandidate.model
      ],
    )
  )
    continue;
  const candidate = evaluatedCandidate(configuredCandidate);
  for (const fixture of matrix.fixtures) {
    const context = fixtureContexts.get(fixture.pull);
    const requirements = visualRequirements(context.files);
    for (
      let repetition = 1;
      repetition <= matrix.repetitions;
      repetition += 1
    ) {
      const id = `${candidate.provider}:${candidate.model}:pr${fixture.pull}:${repetition}`;
      if (result.runs.some((run) => run.id === id)) continue;
      const spent = result.runs
        .filter(({ provider }) => provider === "cheaperinference")
        .reduce((total, run) => total + accountedRunCost(run), 0);
      const reservation = projectedRunCost(candidate);
      if (
        candidate.provider === "cheaperinference" &&
        spent + reservation > matrix.budgetUsd
      )
        throw new Error("CheaperInference evaluation reached its $10 limit");
      const workspace = await mkdtemp(join(tmpdir(), "pr-review-evaluation-"));
      const startedAt = Date.now();
      const runIndex = result.runs.length;
      result.runs.push({
        id,
        provider: candidate.provider,
        model: candidate.model,
        pull: fixture.pull,
        repetition,
        status: "in-progress",
        invocations: 1,
        reservedCostUsd: reservation,
      });
      await writeJsonAtomic(outputPath, result);
      let usage;
      try {
        await writeFile(
          join(workspace, "pull-request.json"),
          `${JSON.stringify(context, null, 2)}\n`,
        );
        const skillSelection = selectRelevantSkills({
          manifest: skillManifest,
          installed: installedSkills,
          files: context.files,
        });
        const review = await runRestrictedReview({
          apiKey: credentials[candidate.provider],
          provider: candidate.provider,
          model: candidate.model,
          skills: skillSelection.selected.length
            ? skillSelection.selected
            : REVIEW_SKILLS,
          prompt: `Review Pocket-Trash/pocket-trash PR #${fixture.pull}. ${visualPrompt(requirements)}`,
          workspace,
          visualRequirements: requirements,
          allowSkillFallback: false,
          maxTransientRetries: 0,
          onUsage: (value) => {
            usage = value;
          },
        });
        review.coverageGaps.push(...skillSelection.coverageGaps);
        if (!usage) throw new Error("OpenCode returned no usage metadata");
        usage = priceUsage(usage, candidate);
        result.runs[runIndex] = {
          id,
          provider: candidate.provider,
          model: candidate.model,
          pull: fixture.pull,
          repetition,
          status: "success",
          latencyMs: Date.now() - startedAt,
          invocations: 1,
          usage,
          review,
          signals: signals(review, fixture.expectedFacts, requirements),
        };
      } catch (error) {
        if (usage) usage = priceUsage(usage, candidate);
        result.runs[runIndex] = {
          id,
          provider: candidate.provider,
          model: candidate.model,
          pull: fixture.pull,
          repetition,
          status: "error",
          latencyMs: Date.now() - startedAt,
          invocations: 1,
          ...(usage ? { usage } : {}),
          reservedCostUsd: Math.max(reservation, usage?.estimatedCostUsd || 0),
          error: error.message,
        };
      } finally {
        await rm(workspace, { recursive: true, force: true });
        await writeJsonAtomic(outputPath, result);
      }
    }
  }
}
