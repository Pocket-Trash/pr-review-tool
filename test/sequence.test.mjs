import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  validateConfig,
  validateVisualAnalysis,
  renderReview,
} from "../src/review.mjs";
import {
  visualRequirements,
  visualPrompt,
  visualSkipReason,
  sanitizeVisuals,
} from "../src/visuals.mjs";
import { runRestrictedReview } from "../src/opencode.mjs";
import { preparePublication } from "../src/publication.mjs";

const fixture = async (name) =>
  JSON.parse(
    await readFile(new URL(`fixtures/${name}`, import.meta.url), "utf8"),
  );
const { files, visuals } = await fixture("sequence.json");
const config = { ...(await fixture("config.visuals.json")), visualPhase: 2 };
const run = await fixture("run.valid.json");
const requirements = visualRequirements(files, 2);

test("Phase 1 preflight refuses Phase 2 and local ineligible Phase 2 skips inference", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sequence-activation-"));
  try {
    const eventPath = join(directory, "event.json");
    const configPath = join(directory, "config.json");
    await writeFile(
      eventPath,
      JSON.stringify(await fixture("events/pull-request-opened.json")),
    );
    await writeFile(configPath, JSON.stringify(config));
    const bootstrap = `globalThis.fetch = async (url) => ({ ok: true, json: async () => url.includes('/comments?') ? [] : url.includes('/contents/') ? { encoding: 'base64', content: Buffer.from(${JSON.stringify(JSON.stringify(config))}).toString('base64') } : url.includes('/pulls/') ? { base: { sha: 'base-sha' }, head: { sha: 'head-sha' } } : { files: [] } });`;
    const preflight = spawnSync(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(bootstrap)}`,
        "src/preflight.mjs",
      ],
      {
        encoding: "utf8",
        env: {
          PATH: process.env.PATH,
          GITHUB_EVENT_PATH: eventPath,
          REVIEW_CONFIG_PATH: ".github/pr-visuals.json",
          REVIEW_TASK: "visuals",
          REVIEW_VISUAL_PHASE: "1",
          GITHUB_TOKEN: "fixture-token",
        },
      },
    );
    assert.notEqual(preflight.status, 0);
    assert.match(preflight.stderr, /visual phase is not activated/);
    await writeFile(
      join(directory, "pull-request.json"),
      JSON.stringify({
        files: [{ filename: "README.md", patch: "+await a new release" }],
      }),
    );
    const local = spawnSync(
      process.execPath,
      [
        "src/local-review.mjs",
        configPath,
        directory,
        "test/fixtures/run.valid.json",
      ],
      { encoding: "utf8", env: { PATH: process.env.PATH } },
    );
    assert.equal(local.status, 0, local.stderr);
    assert.match(local.stdout, /inference was skipped/);
    assert.match(local.stdout, /Model calls: 0/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("sequence eligibility is conditional, source-only and opt-in", () => {
  assert.equal(visualRequirements(files).sequence, undefined);
  assert.equal(requirements.sequence, true);
  assert.equal(visualSkipReason(requirements), null);
  for (const filename of [
    "docs/handler.ts",
    "src/handler.test.ts",
    "fixtures/handler.ts",
    "README.md",
  ])
    assert.ok(
      visualSkipReason(visualRequirements([{ ...files[0], filename }], 2)),
    );
  assert.ok(
    visualSkipReason(
      visualRequirements(
        [{ filename: "src/math.ts", patch: "+const n = 1;" }],
        2,
      ),
    ),
  );
  assert.match(
    visualPrompt(requirements),
    /source establishes participants and call\/message ordering/,
  );
  assert.match(
    visualPrompt(requirements),
    /omit invented or unverified runtime steps/,
  );
  assert.throws(() => validateConfig({ ...config, visualPhase: 3 }), /1 or 2/);
  assert.throws(
    () => validateConfig({ ...config, task: "review" }),
    /used only with task visuals/,
  );
});

test("sequence syntax is strict and shares the visual renderer without findings", async () => {
  assert.throws(
    () => validateVisualAnalysis(visuals),
    /supported diagram kind/,
  );
  assert.equal(validateVisualAnalysis(visuals, 2), visuals);
  const sanitized = await sanitizeVisuals(visuals, requirements);
  assert.deepEqual(sanitized, visuals);
  const markdown = renderReview(config, sanitized, run);
  assert.match(markdown, /^## PR Visuals/);
  assert.match(markdown, /## Diagrams/);
  assert.match(markdown, /sequenceDiagram/);
  assert.doesNotMatch(markdown, /## Findings/);
  for (const mermaid of [
    "sequenceDiagram\n  Handler->>",
    "flowchart LR\n A-->B",
    "sequenceDiagram\nparticipant A\nlink A: Site @ https://example.com",
    "sequenceDiagram\nparticipant A\nA->>A: <b>unsafe</b>",
  ])
    assert.equal(
      (
        await sanitizeVisuals(
          { ...visuals, diagrams: [{ ...visuals.diagrams[0], mermaid }] },
          requirements,
        )
      ).diagrams.length,
      0,
    );
  assert.match(
    (
      await sanitizeVisuals(visuals, visualRequirements(files))
    ).coverageGaps.join("\n"),
    /not eligible/,
  );
});

test("sequence runner and publication require explicit Phase 2 without changing the visual lane", async () => {
  const result = await runRestrictedReview({
    task: "visuals",
    visualPhase: 2,
    model: "fixture-model",
    apiKey: "fixture-key",
    workspace: new URL("fixtures/workspace", import.meta.url).pathname,
    visualRequirements: requirements,
    execute: async (_command, args) => {
      assert.match(args.at(-1), /kind is .*sequence/);
      return {
        stdout: JSON.stringify({
          type: "text",
          part: { text: JSON.stringify(visuals) },
        }),
      };
    },
  });
  assert.deepEqual(result, visuals);
  const artifact = {
    task: "visuals",
    conclusion: "success",
    config,
    review: result,
    run: { ...run, runId: "100" },
  };
  const options = {
    task: "visuals",
    runId: "100",
    reviewedSha: run.reviewedSha,
  };
  await assert.rejects(preparePublication(artifact, options), /not activated/);
  const publication = await preparePublication(artifact, {
    ...options,
    visualPhase: 2,
  });
  assert.match(publication.body, /^<!-- pockettrash:pr-visuals -->/);
  assert.match(publication.body, /sequenceDiagram/);
});

test("sequence consumes the same four-diagram cap and discloses missing/omitted scope", async () => {
  const combined = {
    ...visuals,
    diagrams: [
      {
        kind: "architecture",
        title: "Architecture",
        mermaid: "flowchart LR\n A-->B",
      },
      {
        kind: "schema-domain",
        title: "Domain",
        mermaid: "flowchart LR\n A-->B",
      },
      ...[1, 2].map((n) => ({
        kind: "schema-er",
        title: `Slice ${n}`,
        mermaid: "erDiagram\n A ||--o{ B : owns",
      })),
      ...visuals.diagrams,
    ],
  };
  const sanitized = await sanitizeVisuals(combined, {
    ...requirements,
    architecture: true,
    schema: "large",
  });
  assert.equal(sanitized.diagrams.length, 4);
  assert.match(sanitized.coverageGaps.join("\n"), /cap|visual-scope/);
  assert.match(
    sanitized.coverageGaps.join("\n"),
    /no valid source-grounded sequence/,
  );
});
