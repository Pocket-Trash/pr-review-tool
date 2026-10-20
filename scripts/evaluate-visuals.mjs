import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, open, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  startEvaluationProxy,
  budgetTotal,
} from "../src/evaluation-budget.mjs";
import { writeJsonAtomic } from "../src/evaluation.mjs";
import { runRestrictedReview, VISUAL_SKILLS } from "../src/opencode.mjs";
import { loadChangedFile } from "../src/intake.mjs";
import { prepareReviewContext } from "../src/context.mjs";
import { visualRequirements, visualPrompt } from "../src/visuals.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const json = async (name) =>
  JSON.parse(await readFile(join(root, "evaluation", name), "utf8"));
const spec = await json("visual-fixtures.json");
const matrix = await json("matrix.json");
const ids = [
  "anthropic/claude-sonnet-5.5",
  "moonshotai/kimi-k2.5",
  "z-ai/glm-5.3",
];
if (
  process.env.EVALUATION_BUDGET_USD !== "7.89" ||
  !process.env.OPENROUTER_API_KEY ||
  spec.budgetUsd !== 7.89 ||
  spec.maxSessions !== 27 ||
  spec.maxRequests !== 432 ||
  spec.repetitions !== 3 ||
  spec.approval !== "owner-approved-7.89-visuals-2026-10-20"
)
  throw new Error(
    "Explicit new $7.89 visual-only approval and API key required",
  );
const path = join(root, "evaluation/visual-results.json");
const lock = await open(`${path}.lock`, "wx");
let proxy;
let ledger;
try {
  // An existing campaign is never replayed, replaced or reset by this command.
  const initial = await open(path, "wx", 0o600);
  await initial.close();
  const catalogResponse = await fetch("https://openrouter.ai/api/v1/models", {
    signal: AbortSignal.timeout(20000),
  });
  if (!catalogResponse.ok)
    throw new Error(`Catalog HTTP ${catalogResponse.status}`);
  const catalog = (await catalogResponse.json()).data;
  const models = ids.map((id) => {
    const model = catalog.find((model) => model.id === id);
    if (!model) throw new Error(`Exact model unavailable: ${id}`);
    const entry = {
      id,
      contextLength: model.context_length,
      maxOutputTokens: 32768,
      inputPerMillionUsd: Number(model.pricing.prompt) * 1e6,
      reservedInputPerMillionUsd: Math.max(
        ...[
          model.pricing.prompt,
          model.pricing.input_cache_write,
          model.pricing.input_cache_write_1h,
        ]
          .filter((value) => value !== undefined)
          .map((value) => Number(value) * 1e6),
      ),
      outputPerMillionUsd: Number(model.pricing.completion) * 1e6,
    };
    if (
      ![
        entry.contextLength,
        entry.inputPerMillionUsd,
        entry.reservedInputPerMillionUsd,
        entry.outputPerMillionUsd,
      ].every((value) => Number.isFinite(value) && value > 0)
    )
      throw new Error(`Invalid model limits/pricing: ${id}`);
    return entry;
  });
  ledger = {
    runnerSha: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    campaign: spec.approval,
    task: "visuals",
    visualPhase: 1,
    budgetUsd: 7.89,
    maxSessions: 27,
    maxRequests: 432,
    maxRequestsPerSession: 16,
    repetitions: 3,
    models,
    catalogVerifiedAt: new Date().toISOString(),
    fixtures: matrix.fixtures,
    sessions: [],
    requests: [],
    status: "in-progress",
  };
  const checkpoint = () => writeJsonAtomic(path, ledger);
  await checkpoint();
  const githubToken =
    process.env.GITHUB_TOKEN ||
    execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${githubToken}`,
  };
  const contexts = [];
  for (const fixture of matrix.fixtures) {
    if (!spec.fixtures.some((entry) => entry.pull === fixture.pull))
      throw new Error("Unknown frozen fixture");
    const response = await fetch(
      `https://api.github.com/repos/${spec.repository}/compare/${fixture.baseSha}...${fixture.headSha}?per_page=100`,
      { headers, signal: AbortSignal.timeout(30000) },
    );
    if (!response.ok)
      throw new Error(`Frozen comparison HTTP ${response.status}`);
    const comparison = await response.json();
    if (comparison.files.length >= 300)
      throw new Error(
        "Frozen comparison may be truncated beyond this bounded runner",
      );
    const identity = {
      repository: spec.repository,
      pullNumber: fixture.pull,
      baseSha: fixture.baseSha,
      headSha: fixture.headSha,
    };
    const files = comparison.files.map(
      ({ filename, status, additions, deletions, patch }) => ({
        filename,
        status,
        additions,
        deletions,
        patch,
      }),
    );
    const prepared = await prepareReviewContext(files, matrix.context, (file) =>
      loadChangedFile(identity, file, githubToken, fetch),
    );
    if (prepared.conclusion !== "review")
      throw new Error(`Fixture not reviewable: ${fixture.pull}`);
    const requirements = visualRequirements(prepared.files);
    const expected = spec.fixtures.find((entry) => entry.pull === fixture.pull);
    if (
      requirements.architecture !== expected.architecture ||
      requirements.schema !== expected.schema
    )
      throw new Error("Frozen visual eligibility changed");
    contexts.push({
      fixture,
      requirements,
      context: {
        identity,
        pull: {
          number: fixture.pull,
          title: fixture.title,
          body: "",
          headSha: fixture.headSha,
        },
        files: prepared.files,
        omissions: prepared.omissions,
      },
    });
  }
  proxy = await startEvaluationProxy({
    apiKey: process.env.OPENROUTER_API_KEY,
    models,
    ledger,
    checkpoint,
  });
  for (let repetition = 1; repetition <= 3; repetition++) {
    for (const { fixture, requirements, context } of contexts) {
      for (const model of models) {
        if (
          proxy.blocked ||
          ledger.requests.length >= ledger.maxRequests ||
          ledger.sessions.length >= ledger.maxSessions ||
          budgetTotal(ledger.requests) >= ledger.budgetUsd
        )
          break;
        const id = `visuals:${model.id}:pr${fixture.pull}:${repetition}`;
        const entry = {
          id,
          task: "visuals",
          visualPhase: 1,
          provider: "openrouter",
          model: model.id,
          pull: fixture.pull,
          baseSha: fixture.baseSha,
          headSha: fixture.headSha,
          repetition,
          status: "in-progress",
          startedAt: new Date().toISOString(),
          contextFormat: "plain-text-v1",
          validatorFormat: "node-dom-v1",
          outputFormat: "final-message-v1",
          selectedSkills: [],
          skillOverrides: [],
        };
        ledger.sessions.push(entry);
        await checkpoint();
        proxy.session = id;
        const workspace = await mkdtemp(
          join(tmpdir(), "pr-visual-evaluation-"),
        );
        const started = Date.now();
        try {
          await writeFile(
            join(workspace, "pull-request.json"),
            JSON.stringify(context),
          );
          entry.review = await runRestrictedReview({
            task: "visuals",
            visualPhase: 1,
            provider: "openrouter",
            model: model.id,
            apiKey: proxy.token,
            openRouterBaseURL: proxy.baseURL,
            openRouterModelLimits: {
              context: model.contextLength,
              output: model.maxOutputTokens,
            },
            workspace,
            skills: VISUAL_SKILLS,
            visualRequirements: requirements,
            prompt: `Generate descriptive visual-only analysis for ${spec.repository} PR #${fixture.pull}. ${visualPrompt(requirements)}`,
            allowSkillFallback: false,
            maxTransientRetries: 0,
            onSkillsResolved: (skills) => {
              entry.selectedSkills = skills;
            },
            onUsage: (usage) => {
              entry.usage = usage;
            },
          });
          entry.review.coverageGaps.push(...context.omissions);
          entry.status = "success";
        } catch (error) {
          entry.status = "error";
          entry.error = error.message.slice(0, 1000);
        } finally {
          entry.latencyMs = Date.now() - started;
          await rm(workspace, { recursive: true, force: true });
          await checkpoint();
        }
        const requests = ledger.requests.filter(
          (request) => request.session === id,
        );
        console.log(
          JSON.stringify({
            id,
            status: entry.status,
            requests: requests.length,
            accountedUsd: budgetTotal(ledger.requests),
            ...(entry.error ? { error: entry.error } : {}),
          }),
        );
      }
    }
  }
  ledger.status =
    ledger.sessions.length === 27 && !proxy.blocked
      ? "completed"
      : "stopped-at-guard";
} catch (error) {
  if (ledger) {
    ledger.status = "stopped-error";
    ledger.error = error.message.slice(0, 1000);
  }
  throw error;
} finally {
  if (proxy) await proxy.close();
  if (ledger) {
    ledger.finishedAt = new Date().toISOString();
    await writeJsonAtomic(path, ledger);
  }
  await lock.close();
  await rm(`${path}.lock`, { force: true });
}
