import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runRestrictedReview } from "./opencode.mjs";
import { filterSkillOverrides } from "./skills.mjs";
import {
  visualPrompt,
  visualRequirements,
  visualSkipReason,
} from "./visuals.mjs";
import {
  renderReview,
  validateProductionRoute,
  validateRun,
} from "./review.mjs";

const [configPath, workspace, runPath] = process.argv.slice(2);
if (!configPath || !workspace || !runPath) {
  throw new TypeError(
    "usage: node src/local-review.mjs <config.json> <workspace> <run.json>",
  );
}

const config = validateProductionRoute(
  JSON.parse(await readFile(configPath, "utf8")),
);
const run = validateRun(JSON.parse(await readFile(runPath, "utf8")));
const prepared =
  config.task === "visuals"
    ? JSON.parse(await readFile(join(workspace, "pull-request.json"), "utf8"))
    : undefined;
const requirements = prepared ? visualRequirements(prepared.files) : undefined;
const skipReason = requirements && visualSkipReason(requirements);
run.usage = {
  inputTokens: 0,
  cachedInputTokens: null,
  reasoningTokens: null,
  outputTokens: 0,
  modelCalls: 0,
  toolIterations: 0,
  estimatedCostUsd: 0,
};
if (skipReason) {
  process.stdout.write(
    renderReview(
      config,
      {
        overview: skipReason,
        diagrams: [],
        changedAreas: [],
        coverageGaps: prepared.omissions ?? [],
      },
      {
        ...run,
        selectedSkills: [],
        skillOverrides: [],
      },
    ),
  );
  process.exit(0);
}
let invocations = 0;
let usageReports = 0;
const review = await runRestrictedReview({
  task: config.task,
  apiKey:
    config.provider === "openrouter"
      ? process.env.OPENROUTER_API_KEY
      : process.env.CHEAPER_INFERENCE_API_KEY,
  provider: config.provider,
  model: config.model,
  skills: config.skills,
  prompt: requirements
    ? `${config.prompt}\n${visualPrompt(requirements)}`
    : config.prompt,
  visualRequirements: requirements,
  workspace,
  onSkillsResolved: (skills) => {
    run.selectedSkills = skills;
  },
  onInvocation: () => {
    invocations += 1;
  },
  onUsage: (usage) => {
    usageReports += 1;
    for (const [field, value] of Object.entries(usage)) {
      if (value !== null) run.usage[field] = (run.usage[field] ?? 0) + value;
    }
  },
});
run.skillOverrides = filterSkillOverrides(
  run.skillOverrides,
  run.selectedSkills,
);
review.coverageGaps.push(...(prepared?.omissions ?? []));
if (usageReports < invocations)
  review.coverageGaps.push(
    `${invocations - usageReports} model invocation(s) did not expose usage metadata; recorded usage is a lower bound.`,
  );
process.stdout.write(renderReview(config, review, run));
