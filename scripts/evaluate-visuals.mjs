import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, open, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  startEvaluationProxy,
  budgetTotal,
  reconcileInterruptedEvaluation,
} from "../src/evaluation-budget.mjs";
import { writeJsonAtomic } from "../src/evaluation.mjs";
import { runRestrictedReview, VISUAL_SKILLS } from "../src/opencode.mjs";
import { loadChangedFile } from "../src/intake.mjs";
import { prepareReviewContext } from "../src/context.mjs";
import { preparedVisualRequirements, visualPrompt } from "../src/visuals.mjs";
import { VISUAL_RELIABILITY_FORMATS } from "../src/visual-validation.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const json = async (name) =>
  JSON.parse(await readFile(join(root, "evaluation", name), "utf8"));
const retest = process.argv.includes("--retest");
const reliability = process.argv.includes("--reliability");
if (retest && reliability) throw new TypeError("Select one distinct campaign");
const spec = {
  ...(await json("visual-fixtures.json")),
  ...(retest ? await json("visual-retest-spec.json") : {}),
  ...(reliability ? await json("visual-reliability-spec.json") : {}),
};
const approvedBudget = reliability ? 15 : retest ? 5.08 : 7.89;
const approvedSessions = retest ? 9 : 27;
const approvedRequests = approvedSessions * 16;
const approvedRepetitions = retest ? 1 : 3;
const approval = reliability
  ? "owner-approved-15-visual-reliability-2026-10-20"
  : retest
    ? "owner-approved-5.08-visual-retest-2026-10-20"
    : "owner-approved-7.89-visuals-2026-10-20";
const resultsFile = reliability
  ? "visual-reliability-results.json"
  : retest
    ? "visual-retest-results.json"
    : "visual-results.json";
const matrix = await json("matrix.json");
const ids = [
  "anthropic/claude-sonnet-5.5",
  "moonshotai/kimi-k2.5",
  "z-ai/glm-5.3",
];
if (
  process.env.EVALUATION_BUDGET_USD !== String(approvedBudget) ||
  !process.env.OPENROUTER_API_KEY ||
  spec.budgetUsd !== approvedBudget ||
  spec.maxSessions !== approvedSessions ||
  spec.maxRequests !== approvedRequests ||
  spec.repetitions !== approvedRepetitions ||
  spec.approval !== approval ||
  (reliability &&
    (spec.repairVisuals !== true ||
      spec.estimatedUsd > approvedBudget ||
      spec.maxRequestsPerSession !== 16 ||
      spec.maxOutputTokens !== 32768 ||
      spec.maxInputBytes !== 8388608))
)
  throw new Error(
    `Explicit new $${approvedBudget} visual-only approval and API key required`,
  );
if (
  reliability &&
  Object.entries(VISUAL_RELIABILITY_FORMATS).some(
    ([key, value]) => spec.pipelineFormats?.[key] !== value,
  )
)
  throw new Error(
    "The campaign's frozen pipeline differs from this runner; a separate versioned campaign is required",
  );
const path = join(root, "evaluation", resultsFile);
const resume = process.argv.includes("--resume");
if (
  reliability &&
  execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
    cwd: root,
    encoding: "utf8",
  }).trim()
)
  throw new Error(
    "Commit and offline-validate the reliability runner before paid evaluation",
  );
const lock = await open(`${path}.lock`, "wx");
let proxy;
let ledger;
try {
  if (!resume) {
    const initial = await open(path, "wx", 0o600);
    await initial.close();
  }
  const catalogResponse = await fetch("https://openrouter.ai/api/v1/models", {
    signal: AbortSignal.timeout(20000),
  });
  if (!catalogResponse.ok)
    throw new Error(`Catalog HTTP ${catalogResponse.status}`);
  const catalog = (await catalogResponse.json()).data;
  let models = ids.map((id) => {
    const model = catalog.find((model) => model.id === id);
    if (!model) throw new Error(`Exact model unavailable: ${id}`);
    const entry = {
      id,
      contextLength: model.context_length,
      maxOutputTokens: 32768,
      ...(reliability ? { maxInputBytes: spec.maxInputBytes } : {}),
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
  let creditBefore;
  if (reliability && !resume) {
    const response = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: { authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new Error(`Credit preflight HTTP ${response.status}`);
    const { data } = await response.json();
    const availableUsd = data.total_credits - data.total_usage;
    if (!Number.isFinite(availableUsd) || availableUsd < approvedBudget)
      throw new Error(
        "Available credits do not fund the approved campaign cap",
      );
    creditBefore = { checkedAt: new Date().toISOString(), availableUsd };
  }
  const initialLedger = {
    runnerSha: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    campaign: spec.approval,
    task: "visuals",
    visualPhase: 1,
    budgetUsd: approvedBudget,
    maxSessions: approvedSessions,
    maxRequests: approvedRequests,
    maxRequestsPerSession: 16,
    repetitions: approvedRepetitions,
    models,
    catalogVerifiedAt: new Date().toISOString(),
    fixtures: matrix.fixtures,
    sessions: [],
    requests: [],
    status: "in-progress",
    ...(reliability
      ? { pipelineFormats: VISUAL_RELIABILITY_FORMATS, creditBefore }
      : {}),
  };
  if (resume) {
    const existing = await json(resultsFile);
    if (
      existing.campaign !== spec.approval ||
      existing.budgetUsd !== approvedBudget ||
      existing.maxSessions !== approvedSessions ||
      existing.maxRequests !== approvedRequests ||
      existing.repetitions !== approvedRepetitions ||
      existing.maxRequestsPerSession !== 16 ||
      existing.status !== "in-progress" ||
      JSON.stringify(existing.fixtures) !== JSON.stringify(matrix.fixtures) ||
      existing.models.map((model) => model.id).join() !== ids.join() ||
      budgetTotal(existing.requests) > approvedBudget ||
      (reliability &&
        (existing.runnerSha !== initialLedger.runnerSha ||
          JSON.stringify(existing.pipelineFormats) !==
            JSON.stringify(VISUAL_RELIABILITY_FORMATS)))
    )
      throw new Error(
        "Resume requires the unchanged interrupted visual campaign",
      );
    ledger = existing;
    for (const current of models) {
      const approved = ledger.models.find((model) => model.id === current.id);
      if (
        current.inputPerMillionUsd > approved.inputPerMillionUsd ||
        current.outputPerMillionUsd > approved.outputPerMillionUsd ||
        current.reservedInputPerMillionUsd > approved.reservedInputPerMillionUsd
      )
        throw new Error(
          "Catalog price increased; frozen campaign ceilings cannot be expanded",
        );
    }
    await reconcileInterruptedEvaluation(ledger, async (id) => {
      const response = await fetch(
        `https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(id)}`,
        {
          headers: {
            authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          },
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!response.ok)
        throw new Error(
          `Generation receipt HTTP ${response.status}; reservation retained`,
        );
      return (await response.json()).data;
    });
    ledger.resumptions = [
      ...(ledger.resumptions ?? []),
      {
        at: new Date().toISOString(),
        runnerSha: initialLedger.runnerSha,
        reason:
          "Owner requested resume after interruption; existing sessions skipped, no replacements.",
      },
    ];
    models = ledger.models;
  } else ledger = initialLedger;
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
    const requirements = preparedVisualRequirements(prepared);
    if (!prepared.files.length)
      throw new Error("Frozen visual fixture has no available source");
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
        eligibilityFiles: prepared.eligibilityFiles,
      },
    });
  }
  proxy = await startEvaluationProxy({
    apiKey: process.env.OPENROUTER_API_KEY,
    models,
    ledger,
    checkpoint,
  });
  for (let repetition = 1; repetition <= approvedRepetitions; repetition++) {
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
        if (ledger.sessions.some((session) => session.id === id)) continue;
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
          status: "planned",
          contextFormat: "plain-text-v1",
          validatorFormat: "node-dom-v1",
          outputFormat: "final-message-v1",
          selectedSkills: [],
          skillOverrides: [],
          ...(reliability
            ? {
                pipelineFormats: VISUAL_RELIABILITY_FORMATS,
                invocations: 0,
                usageReports: 0,
              }
            : {}),
        };
        ledger.sessions.push(entry);
        await checkpoint();
        const sessionToken = proxy.authorizeSession(id);
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
            apiKey: sessionToken,
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
            repairVisuals: reliability,
            onVisualValidation: (report) => {
              if (reliability) entry.visualValidation = report;
            },
            onInvocation: () => {
              if (reliability) entry.invocations++;
            },
            onSkillsResolved: (skills) => {
              entry.selectedSkills = skills;
            },
            onUsage: (usage) => {
              if (reliability) entry.usageReports++;
              if (!entry.usage) entry.usage = usage;
              else
                for (const [field, value] of Object.entries(usage)) {
                  if (
                    field === "estimatedCostUsd" &&
                    (value === null || entry.usage[field] === null)
                  )
                    entry.usage[field] = null;
                  else if (value !== null)
                    entry.usage[field] = (entry.usage[field] ?? 0) + value;
                }
            },
            onEvidence: (report) => {
              entry.evidence = report;
            },
          });
          entry.review.coverageGaps.push(...context.omissions);
          entry.status = "success";
        } catch (error) {
          if (
            ![
              "deferred-unstarted",
              "budget-limited",
              "request-limited",
            ].includes(entry.status)
          )
            entry.status = "error";
          entry.error = error.message.slice(0, 1000);
        } finally {
          entry.latencyMs = Date.now() - started;
          await proxy.finishSession(id);
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
    ledger.sessions.length === approvedSessions &&
    !proxy.blocked &&
    !ledger.sessions.some((session) =>
      ["deferred-unstarted", "budget-limited", "request-limited"].includes(
        session.status,
      ),
    )
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
    if (reliability && ledger.creditBefore) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/credits", {
          headers: {
            authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          },
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) throw new Error("Credit reconciliation unavailable");
        const { data } = await response.json();
        const afterUsd = data.total_credits - data.total_usage;
        if (!Number.isFinite(afterUsd))
          throw new Error("Invalid credit response");
        const returnedBilledUsd = ledger.requests.reduce(
          (sum, request) => sum + (request.costUsd ?? 0),
          0,
        );
        ledger.creditReconciliation = {
          checkedAt: new Date().toISOString(),
          beforeUsd: ledger.creditBefore.availableUsd,
          afterUsd,
          returnedBilledUsd,
          outstandingReservations: ledger.requests.filter(
            (request) => !Number.isFinite(request.costUsd),
          ).length,
          deltaMatchesBilled:
            Math.abs(
              ledger.creditBefore.availableUsd - afterUsd - returnedBilledUsd,
            ) < 0.000001,
        };
      } catch {
        ledger.creditReconciliation = {
          checkedAt: new Date().toISOString(),
          status: "unavailable; request reservations retained",
        };
      }
    }
    ledger.finishedAt = new Date().toISOString();
    await writeJsonAtomic(path, ledger);
  }
  await lock.close();
  await rm(`${path}.lock`, { force: true });
}
