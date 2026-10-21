import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runRestrictedReview } from "../src/opencode.mjs";
import {
  renderReview,
  validateConfig,
  validateVisualAnalysis,
} from "../src/review.mjs";
import { selectRelevantSkills } from "../src/skills.mjs";
import { visualRequirements, visualSkipReason } from "../src/visuals.mjs";

const json = async (path) =>
  JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const config = await json("./fixtures/config.visuals.json");
const visuals = await json("./fixtures/visuals.valid.json");
const run = await json("./fixtures/run.valid.json");
const workspace = new URL("./fixtures/workspace", import.meta.url).pathname;
const requirements = { architecture: true, schema: "none" };
const response = (value) => ({
  stdout: JSON.stringify({
    type: "text",
    part: { text: JSON.stringify(value) },
  }),
});

test("visual output has exactly four keys, including nested boundaries", () => {
  assert.equal(validateVisualAnalysis(visuals), visuals);
  for (const field of [
    "findings",
    "severity",
    "impact",
    "recommendation",
    "status",
  ]) {
    assert.throws(
      () => validateVisualAnalysis({ ...visuals, [field]: [] }),
      /unknown fields/,
    );
  }
  for (const key of Object.keys(visuals)) {
    const incomplete = { ...visuals };
    delete incomplete[key];
    assert.throws(() => validateVisualAnalysis(incomplete));
  }
  assert.throws(
    () =>
      validateVisualAnalysis({
        ...visuals,
        changedAreas: [
          { area: "Queue", summary: "Description", severity: "high" },
        ],
      }),
    /unknown fields/,
  );
  assert.throws(
    () => validateConfig({ ...config, task: "both" }),
    /review or visuals/,
  );
});

test("visual renderer and fixture CLI have no findings section", () => {
  const markdown = renderReview(config, visuals, {
    ...run,
    selectedSkills: ["i-have-adhd", "stop-slop"],
  });
  assert.match(markdown, /^## PR Visuals\n/);
  assert.match(markdown, /```mermaid/);
  assert.match(markdown, /Coverage gaps/);
  assert.match(markdown, /Run and cost details/);
  assert.doesNotMatch(markdown, /## Findings|No findings|Smallest fix/);
  assert.throws(
    () => renderReview(config, { ...visuals, findings: [] }, run),
    /unknown fields/,
  );
  const result = spawnSync(
    process.execPath,
    [
      "src/fixture.mjs",
      "test/fixtures/config.visuals.json",
      "test/fixtures/visuals.valid.json",
      "test/fixtures/run.valid.json",
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^## PR Visuals/);
});

test("visual skill selection excludes reviewers even when explicitly configured", async () => {
  const manifest = await json("../skills/manifest.json");
  const installed = new Map(
    manifest.sources.flatMap(({ skills }) =>
      skills.map(({ name }) => [name, { name }]),
    ),
  );
  const selected = selectRelevantSkills({
    task: "visuals",
    manifest,
    installed,
    files: [{ filename: "schema.ts" }],
    configured: ["review-coordinator", "ponytail-review"],
  });
  assert.ok(selected.selected.includes("i-have-adhd"));
  assert.ok(selected.selected.includes("stop-slop"));
  assert.ok(!selected.selected.includes("review-coordinator"));
  assert.ok(!selected.selected.includes("ponytail-review"));
});

test("Phase 2 execution preserves its dedicated contract and only the chosen provider credential", async () => {
  for (const provider of ["cheaperinference", "openrouter"]) {
    const result = await runRestrictedReview({
      task: "visuals",
      visualPhase: 2,
      apiKey: "fixture-key",
      provider,
      model: "fixture-model",
      workspace,
      skills: [
        "review-coordinator",
        "ponytail-review",
        "i-have-adhd",
        "stop-slop",
      ],
      visualRequirements: requirements,
      execute: async (_command, args, options) => {
        assert.match(args.at(-1), /visual coordinator, not a code reviewer/);
        assert.match(args.at(-1), /exactly these four top-level keys/);
        assert.match(
          args.at(-1),
          /Frozen repository evidence and installed-version constraints override/,
        );
        assert.match(
          args.at(-1),
          /Distinguish unread, omitted and unavailable evidence/,
        );
        assert.match(
          args.at(-1),
          /Anchor each asserted relationship to source file\/line evidence/,
        );
        assert.doesNotMatch(
          args.at(-1),
          /Load .*review-coordinator|Load .*ponytail-review/,
        );
        const credential =
          provider === "openrouter"
            ? "OPENROUTER_API_KEY"
            : "CHEAPER_INFERENCE_API_KEY";
        const other =
          provider === "openrouter"
            ? "CHEAPER_INFERENCE_API_KEY"
            : "OPENROUTER_API_KEY";
        assert.equal(options.env[credential], "fixture-key");
        assert.equal(options.env[other], undefined);
        const permissions = JSON.parse(
          options.env.OPENCODE_CONFIG_CONTENT,
        ).permission;
        assert.equal(permissions.bash, undefined);
        assert.equal(permissions["*"], "deny");
        return response(visuals);
      },
    });
    assert.deepEqual(result, visuals);
  }
});

test("visual runner rejects review results and cannot override its contract", async () => {
  const options = {
    task: "visuals",
    visualPhase: 2,
    apiKey: "fixture-key",
    model: "fixture-model",
    workspace,
    visualRequirements: requirements,
  };
  await assert.rejects(
    runRestrictedReview({
      ...options,
      execute: async () => response({ ...visuals, findings: [] }),
    }),
    /valid structured review/,
  );
  await assert.rejects(
    runRestrictedReview({
      ...options,
      resultFormat: { instructions: "Review", validate: (v) => v },
    }),
    /cannot override/,
  );
  await assert.rejects(
    runRestrictedReview({ ...options, visualRequirements: undefined }),
    /explicit eligibility/,
  );
  await assert.rejects(
    runRestrictedReview({
      ...options,
      visualRequirements: { architecture: false, schema: "none" },
      execute: async () => assert.fail("ineligible invocation"),
    }),
    /must be skipped/,
  );
});

test("visual fallback stays in the visual lane and unsafe diagrams become visible gaps", async () => {
  let calls = 0;
  const result = await runRestrictedReview({
    task: "visuals",
    visualPhase: 2,
    apiKey: "fixture-key",
    model: "fixture-model",
    workspace,
    skills: ["i-have-adhd", "stop-slop", "optional-specialist"],
    visualRequirements: requirements,
    execute: async (_command, args) => {
      calls += 1;
      if (calls === 1)
        throw Object.assign(new Error("skill unavailable"), {
          stderr: "skill load failed",
        });
      assert.match(args.at(-1), /Load i-have-adhd, stop-slop\./);
      assert.doesNotMatch(args.at(-1), /review-coordinator/);
      return response({
        ...visuals,
        diagrams: [
          ...visuals.diagrams,
          {
            kind: "architecture",
            title: "Unsafe",
            mermaid: 'flowchart LR\n A-->B\n click A "https://example.com"',
          },
        ],
      });
    },
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.diagrams, visuals.diagrams);
  assert.match(result.coverageGaps.join("\n"), /click directive/);
  assert.match(result.coverageGaps.join("\n"), /base visual coordinator/);
  assert.ok(!("findings" in result));
});

test("local ineligible visuals skip inference without credentials and zero old usage", async () => {
  const directory = await mkdtemp(join(tmpdir(), "visual-skip-test-"));
  try {
    const files = [{ filename: "README.md", additions: 2, deletions: 0 }];
    assert.match(
      visualSkipReason(visualRequirements(files)),
      /inference was skipped/,
    );
    assert.equal(visualSkipReason(requirements), null);
    await writeFile(
      join(directory, "pull-request.json"),
      JSON.stringify({ files }),
    );
    const result = spawnSync(
      process.execPath,
      [
        "src/local-review.mjs",
        "test/fixtures/config.visuals.json",
        directory,
        "test/fixtures/run.valid.json",
      ],
      { encoding: "utf8", env: { PATH: process.env.PATH } },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /inference was skipped/);
    assert.match(result.stdout, /Model calls: 0/);
    assert.match(result.stdout, /Estimated cost: \$0.00000/);
    assert.doesNotMatch(result.stdout, /## Findings/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("local eligible visuals report actual skills and usage rather than fixture metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "local-visual-run-"));
  try {
    await writeFile(
      join(directory, "pull-request.json"),
      JSON.stringify({
        identity: { headSha: "a".repeat(40), baseSha: "b".repeat(40) },
        files: [
          {
            filename: "packages/queue/queue.ts",
            additions: 50,
            deletions: 0,
            patch: "+{}",
            content: 'const queue=service("queue");',
          },
        ],
        omissions: ["generated/schema.ts: excluded"],
      }),
    );
    const stdout = [
      {
        type: "step_finish",
        part: { tokens: { input: 50, output: 10 }, cost: 0.001 },
      },
      {
        type: "text",
        part: {
          text: JSON.stringify({
            factIds: ["f0"],
            diagrams: [
              {
                kind: "architecture",
                relationshipIds: ["r0"],
              },
            ],
          }),
        },
      },
    ]
      .map((event) => JSON.stringify(event))
      .join("\n");
    await writeFile(
      join(directory, "npx"),
      `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(stdout)});\n`,
      { mode: 0o755 },
    );
    const result = spawnSync(
      process.execPath,
      [
        "src/local-review.mjs",
        "test/fixtures/config.visuals.json",
        directory,
        "test/fixtures/run.valid.json",
      ],
      {
        encoding: "utf8",
        env: {
          PATH: `${directory}:${process.env.PATH}`,
          CHEAPER_INFERENCE_API_KEY: "fixture-key",
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Skills: i-have-adhd, stop-slop/);
    assert.match(result.stdout, /Tokens: 50 input/);
    assert.match(result.stdout, /Model calls: 1/);
    assert.match(result.stdout, /Estimated cost: \$0.00100/);
    assert.match(result.stdout, /generated\/schema.ts: excluded/);
    assert.doesNotMatch(result.stdout, /review-coordinator|## Findings/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("automatic visuals distinguish trusted exclusions from unavailable eligible source without spending", async () => {
  const directory = await mkdtemp(join(tmpdir(), "automatic-visual-skip-"));
  try {
    const event = {
      action: "synchronize",
      repository: { full_name: "Pocket-Trash/example" },
      pull_request: {
        number: 42,
        base: { sha: "base-sha" },
        head: { sha: "head-sha", repo: { fork: false } },
      },
    };
    const eventPath = join(directory, "event.json");
    const artifactPath = join(directory, "artifact.json");
    await writeFile(eventPath, JSON.stringify(event));
    const bootstrap = `
      const config = ${JSON.stringify(config)};
      globalThis.fetch = async (url) => {
        let body;
        if (url.includes('/contents/.github%2Fpr-review.json')) body = { encoding: 'base64', content: Buffer.from(JSON.stringify(config)).toString('base64') };
        else if (url.includes('/pulls/42')) body = { base: { sha: 'base-sha' }, head: { sha: 'head-sha' } };
        else if (url.includes('/compare/')) body = { files: [
          { filename: 'infra/generated/railway.json', additions: 1, deletions: 0, patch: '+{}' },
          { filename: process.env.FIXTURE_MISSING_FILE, additions: 1, deletions: 0 }
        ] };
        else throw new Error('Unexpected API or inference request: ' + url);
        return { ok: true, json: async () => body };
      };
    `;
    for (const missingFile of ["schema.ts", "README.md"]) {
      const result = spawnSync(
        process.execPath,
        [
          "--import",
          `data:text/javascript,${encodeURIComponent(bootstrap)}`,
          "src/automatic-review.mjs",
        ],
        {
          encoding: "utf8",
          env: {
            PATH: process.env.PATH,
            GITHUB_EVENT_PATH: eventPath,
            GITHUB_TOKEN: "fixture-token",
            GITHUB_RUN_ID: "fixture-visuals",
            REVIEW_TASK: "visuals",
            REVIEW_CONFIG_PATH: ".github/pr-review.json",
            REVIEW_ARTIFACT_PATH: artifactPath,
            FIXTURE_MISSING_FILE: missingFile,
          },
        },
      );
      assert.equal(
        result.status,
        missingFile === "schema.ts" ? 1 : 0,
        result.stderr,
      );
      const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
      assert.equal(artifact.task, "visuals");
      assert.equal(artifact.review, null);
      assert.equal(artifact.run.usage.modelCalls, 0);
      assert.equal(artifact.run.usage.estimatedCostUsd, 0);
      assert.deepEqual(artifact.selectedSkills, []);
      assert.equal(
        artifact.conclusion,
        missingFile === "schema.ts" ? "failure" : "neutral",
      );
      assert.match(
        artifact.diagnostics.join("\n"),
        missingFile === "schema.ts"
          ? /incomplete, not a no-work skip/
          : /inference was skipped/,
      );
      assert.match(artifact.omissions.join("\n"), /generated-file pattern/);
      assert.match(artifact.omissions.join("\n"), /patch unavailable/);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
