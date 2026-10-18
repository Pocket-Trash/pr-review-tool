import { mkdtemp, readFile, writeFile, rm, open } from "node:fs/promises";
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
import { writeJsonAtomic } from "../src/evaluation.mjs";
import {
  startEvaluationProxy,
  budgetTotal,
} from "../src/evaluation-budget.mjs";
import {
  peerFindings,
  peerEvidence,
  critiqueFormat,
  combinePeerReviews,
} from "../src/peer-review.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const matrix = JSON.parse(
  await readFile(join(root, "evaluation/matrix.json"), "utf8"),
);
const manifest = JSON.parse(
  await readFile(join(root, "skills/manifest.json"), "utf8"),
);
const path = join(root, "evaluation/peer-results.json");
const ids = ["moonshotai/kimi-k2.5", "z-ai/glm-5.3"];
if (
  process.env.EVALUATION_BUDGET_USD !== "10" ||
  !process.env.OPENROUTER_API_KEY
)
  throw new Error(
    "Explicit EVALUATION_BUDGET_USD=10 and OPENROUTER_API_KEY required",
  );
const lock = await open(`${path}.lock`, "wx");
let proxy;
try {
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(`OpenRouter catalog HTTP ${response.status}`);
  const catalog = (await response.json()).data;
  const models = ids.map((id) => {
    const model = catalog.find((model) => model.id === id);
    if (!model) throw new Error(`Exact model unavailable: ${id}`);
    const entry = {
      id,
      contextLength: model.context_length,
      maxOutputTokens: 32768,
      inputPerMillionUsd: Number(model.pricing.prompt) * 1e6,
      outputPerMillionUsd: Number(model.pricing.completion) * 1e6,
    };
    if (
      ![
        entry.contextLength,
        entry.inputPerMillionUsd,
        entry.outputPerMillionUsd,
      ].every((value) => Number.isFinite(value) && value > 0)
    )
      throw new Error(`Invalid model pricing/limits: ${id}`);
    return entry;
  });
  let ledger = {
    campaign: "kimi-k25-glm-53-peer-v1",
    budgetUsd: 10,
    maxSessions: 41,
    repetitions: 3,
    models,
    catalogVerifiedAt: new Date().toISOString(),
    fixtures: matrix.fixtures,
    sessions: [],
    requests: [],
    combined: [],
  };
  try {
    ledger = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (
    ledger.campaign !== "kimi-k25-glm-53-peer-v1" ||
    ledger.budgetUsd !== 10 ||
    ledger.maxSessions !== 41 ||
    JSON.stringify(ledger.fixtures) !== JSON.stringify(matrix.fixtures)
  )
    throw new Error("Campaign identity or frozen fixtures changed");
  // Freeze the first verified price ceilings; later price increases cannot silently enlarge them.
  const checkpoint = () => writeJsonAtomic(path, ledger);
  if (!ledger.providerUsageBefore) {
    const response = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(20000),
    });
    if (response.ok) {
      const { data } = await response.json();
      ledger.providerUsageBefore = {
        at: new Date().toISOString(),
        usage: data.usage,
        limit: data.limit,
        limitRemaining: data.limit_remaining,
      };
    }
  }
  await checkpoint();
  const installed = new Map([
    ...(await discoverInstalledSkills(join(root, "skills"))),
    ...(await discoverInstalledSkills(join(root, ".agents/skills"))),
  ]);
  for (const name of manifest.sources.flatMap((source) =>
    source.skills.map((skill) => skill.name),
  ))
    if (!installed.has(name))
      throw new Error(`Missing pinned skill ${name}; run skills:install`);
  proxy = await startEvaluationProxy({
    apiKey: process.env.OPENROUTER_API_KEY,
    models: ledger.models,
    ledger,
    checkpoint,
  });
  const headers = {
    accept: "application/vnd.github+json",
    ...(process.env.GITHUB_TOKEN
      ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {}),
  };
  async function contextFor(fixture) {
    const response = await fetch(
      `https://api.github.com/repos/Pocket-Trash/pocket-trash/compare/${fixture.baseSha}...${fixture.headSha}?per_page=100`,
      { headers, signal: AbortSignal.timeout(30000) },
    );
    if (!response.ok)
      throw new Error(`Frozen comparison HTTP ${response.status}`);
    const files = (await response.json()).files.map(
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
      loadChangedFile(identity, file, process.env.GITHUB_TOKEN, fetch),
    );
    if (prepared.conclusion !== "review")
      throw new Error(`Frozen fixture is not reviewable: ${fixture.pull}`);
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
  async function session(model, fixture, repetition, context, peer) {
    const stage = peer ? "critique" : "independent";
    const originalId = `${stage}:${model}:pr${fixture.pull}:${repetition}`;
    const replacement =
      !peer &&
      model === ids[0] &&
      fixture.pull === 403 &&
      ledger.sessions.some(
        (session) =>
          session.id === originalId &&
          session.status === "error" &&
          !session.envelopeFormat,
      );
    const limitReplacement =
      !peer &&
      model === ids[1] &&
      fixture.pull === 354 &&
      [2, 3].includes(repetition) &&
      ledger.sessions.some(
        (session) =>
          session.id === originalId &&
          session.status === "error" &&
          session.limitDiagnostic?.providerFinishReason === "length",
      );
    const id = replacement
      ? `${originalId}:envelope-replacement`
      : limitReplacement
        ? `${originalId}:output-limit-replacement`
        : originalId;
    const existing = ledger.sessions.find((session) => session.id === id);
    const priorRequests = ledger.requests.filter(
      (request) => request.session === id,
    );
    const resumeSetup =
      (existing?.status === "in-progress" && !priorRequests.length) ||
      (existing?.status === "error" &&
        !existing.routingCeilingResumed &&
        priorRequests.length > 0 &&
        priorRequests.every(
          (request) =>
            request.httpStatus === 404 &&
            request.status === "error" &&
            request.costUsd === undefined,
        ));
    if (existing && !resumeSetup) return existing; // Never replay a paid/interrupted attempt.
    if (proxy.blocked)
      throw new Error(
        "Campaign paused: request accounting needs reconciliation or the next conservative reservation cannot fit the budget",
      );
    if (!resumeSetup && ledger.sessions.length >= ledger.maxSessions)
      throw new Error("Campaign session ceiling reached");
    if (budgetTotal(ledger.requests) >= ledger.budgetUsd)
      throw new Error("Campaign reached its approved spending limit");
    const entry = existing || {
      id,
      stage,
      model,
      pull: fixture.pull,
      repetition,
      status: "in-progress",
      startedAt: new Date().toISOString(),
      contextFormat: "plain-text-v1",
      validatorFormat: "node-dom-v1",
      outputFormat: "final-message-v1",
      envelopeFormat: "single-json-fence-v1",
      ...(replacement
        ? {
            replacesSession: originalId,
            replacementReason:
              "Initial attempt rejected by strict prose-envelope handling; separately counted within the same $10 allowance.",
          }
        : {}),
      ...(limitReplacement
        ? {
            replacesSession: originalId,
            replacementReason:
              "Provider confirmed native output reached the runner's 16384-token cap; use 32768 within unchanged $10 allowance.",
          }
        : {}),
      ...(peer ? { peerSession: peer.id } : {}),
    };
    if (resumeSetup) {
      entry.setupHistory = [
        ...(entry.setupHistory || []),
        {
          at: new Date().toISOString(),
          priorError: entry.error || null,
          priorRequestIds: priorRequests.map((request) => request.id),
          reason: priorRequests.length
            ? "No generation endpoint matched old price ceiling (HTTP 404); resume setup once under the owner's quoted output ceiling."
            : "Prior setup interrupted before any API request.",
        },
      ];
      if (priorRequests.length) entry.routingCeilingResumed = true;
      entry.setupResumedAt = new Date().toISOString();
      entry.status = "in-progress";
      entry.envelopeFormat = "single-json-fence-v1";
      delete entry.error;
    } else ledger.sessions.push(entry);
    await checkpoint();
    proxy.session = id;
    const started = Date.now();
    const workspace = await mkdtemp(join(tmpdir(), "pr-review-peer-"));
    try {
      await writeFile(
        join(workspace, "pull-request.json"),
        `${JSON.stringify(context, null, 2)}\n`,
      );
      const requirements = visualRequirements(context.files);
      const selection = selectRelevantSkills({
        manifest,
        installed,
        files: context.files,
      });
      const findings = peer ? peerFindings(peer.review) : undefined;
      if (peer)
        await writeFile(
          join(workspace, "peer-findings.txt"),
          peerEvidence(findings),
        );
      const value = await runRestrictedReview({
        apiKey: proxy.token,
        provider: "openrouter",
        model,
        openRouterBaseURL: proxy.baseURL,
        openRouterModelLimits: {
          context: ledger.models.find((entry) => entry.id === model)
            .contextLength,
          output: 32768,
        },
        skills: (selection.selected.length
          ? selection.selected
          : REVIEW_SKILLS
        ).filter((name) => !peer || name !== "review-coordinator"),
        workspace,
        allowSkillFallback: false,
        maxTransientRetries: 0,
        visualRequirements: requirements,
        ...(peer ? { resultFormat: critiqueFormat(findings) } : {}),
        prompt: peer
          ? `Critique every finding in peer-findings.txt against the frozen source for PR #${fixture.pull}. Independently verify its evidence, impact, and severity; do not assume peer agreement means correctness. Do not perform a new general review. Return a verdict for every finding.`
          : `Independently review Pocket-Trash/pocket-trash PR #${fixture.pull}. ${visualPrompt(requirements)}`,
        onUsage: (usage) => {
          entry.usage = usage;
        },
      });
      if (!entry.usage) throw new Error("Missing OpenCode usage metadata");
      if (peer) entry.critique = value;
      else {
        entry.review = value;
        entry.review.coverageGaps.push(...selection.coverageGaps);
      }
      entry.status = "success";
    } catch (error) {
      entry.status = "error";
      entry.error = error.message.slice(0, 1000);
      if (error.cause)
        entry.validationDetail = error.cause.message.slice(0, 1000);
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
        accountedCostUsd: budgetTotal(requests),
        totalAccountedUsd: budgetTotal(ledger.requests),
        ...(entry.error ? { error: entry.error } : {}),
      }),
    );
    return entry;
  }
  for (const fixture of matrix.fixtures) {
    const context = await contextFor(fixture);
    for (let repetition = 1; repetition <= 3; repetition++) {
      const independent = [];
      // Separate workspaces and processes: neither initial review sees the other.
      for (const model of ids)
        independent.push(await session(model, fixture, repetition, context));
      if (independent.some((session) => session.status !== "success")) continue;
      const critiques = [];
      for (let critic = 0; critic < 2; critic++)
        critiques.push(
          await session(
            ids[critic],
            fixture,
            repetition,
            context,
            independent[1 - critic],
          ),
        );
      if (critiques.some((session) => session.status !== "success")) continue;
      const id = `combined:pr${fixture.pull}:${repetition}`;
      if (!ledger.combined.some((result) => result.id === id)) {
        ledger.combined.push({
          id,
          pull: fixture.pull,
          repetition,
          sessions: [...independent, ...critiques].map((session) => session.id),
          ...combinePeerReviews(
            independent.map((session) => session.review),
            critiques.map((session) => session.critique),
          ),
        });
        await checkpoint();
      }
    }
  }
  console.log(
    JSON.stringify({
      sessions: ledger.sessions.length,
      combined: ledger.combined.length,
      accountedUsd: budgetTotal(ledger.requests),
    }),
  );
  const finalUsage = await fetch("https://openrouter.ai/api/v1/key", {
    headers: { authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    signal: AbortSignal.timeout(20000),
  });
  if (finalUsage.ok) {
    const { data } = await finalUsage.json();
    ledger.providerUsageAfter = {
      at: new Date().toISOString(),
      usage: data.usage,
    };
    await checkpoint();
  }
} finally {
  if (proxy) await proxy.close();
  await lock.close();
  await rm(`${path}.lock`);
}
