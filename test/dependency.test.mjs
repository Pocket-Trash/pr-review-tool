import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateVisualAnalysis, renderReview } from "../src/review.mjs";
import {
  visualRequirements,
  visualPrompt,
  visualSkipReason,
  sanitizeVisuals,
} from "../src/visuals.mjs";
import { loadBaseEvidence, loadRepositoryFile } from "../src/intake.mjs";
import { materializeReviewEvidence } from "../src/workspace.mjs";
import { evaluateVisualTrial } from "../src/visual-evaluation.mjs";

const fixture = async (name) =>
  JSON.parse(
    await readFile(new URL(`fixtures/${name}`, import.meta.url), "utf8"),
  );
const { files, visuals, unsupported } = await fixture("dependency.json");
const run = await fixture("run.valid.json");
const requirements = visualRequirements(files, 2);

test("automatic manifest-only metadata changes fetch frozen base evidence but skip inference", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dependency-auto-skip-"));
  try {
    const eventPath = join(directory, "event.json");
    const artifactPath = join(directory, "artifact.json");
    await writeFile(
      eventPath,
      JSON.stringify(await fixture("events/pull-request-opened.json")),
    );
    const config = {
      ...(await fixture("config.visuals.json")),
      visualPhase: 2,
    };
    const bootstrap = `
      globalThis.fetch = async (url) => {
        let body;
        if (url.includes('/comments?')) return new Response('[]');
        if (url.includes('/contents/.github%2Fpr-visuals.json')) body = { encoding: 'base64', content: Buffer.from(${JSON.stringify(JSON.stringify(config))}).toString('base64') };
        else if (url.includes('/pulls/42')) body = { base: { sha: 'base-sha' }, head: { sha: 'head-sha' } };
        else if (url.includes('/compare/')) body = { files: [{ filename: 'package.json', status: 'modified', additions: 1, deletions: 1, patch: '-"version":"1"\\n+"version":"2"' }] };
        else if (url.endsWith('/contents/package.json?ref=head-sha') || url.endsWith('/contents/package.json?ref=base-sha')) {
          const content = JSON.stringify({ version: url.endsWith('ref=base-sha') ? '1' : '2', dependencies: { a: '1' } });
          body = { encoding: 'base64', size: content.length, content: Buffer.from(content).toString('base64') };
        } else throw new Error('Unexpected source or inference request: ' + url);
        return new Response(JSON.stringify(body));
      };
    `;
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
          GITHUB_RUN_ID: "fixture-dependencies",
          REVIEW_CONFIG_PATH: ".github/pr-visuals.json",
          REVIEW_TASK: "visuals",
          REVIEW_VISUAL_PHASE: "2",
          REVIEW_ARTIFACT_PATH: artifactPath,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
    assert.equal(artifact.conclusion, "neutral");
    assert.equal(artifact.task, "visuals");
    assert.equal(artifact.run.usage.modelCalls, 0);
    assert.match(artifact.diagnostics.join("\n"), /inference was skipped/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("dependency eligibility uses frozen declared edges/imports, not manifest metadata or installs", () => {
  assert.equal(visualRequirements(files).dependency, undefined);
  assert.equal(requirements.dependency, true);
  assert.equal(visualSkipReason(requirements), null);
  for (const file of [
    {
      filename: "package.json",
      baseContent: '{"version":"1","dependencies":{"a":"1"}}',
      content: '{"version":"2","dependencies":{"a":"1"}}',
      patch: '+"version": "2"',
    },
    { ...files[0], baseContent: undefined },
    { ...files[1], filename: "docs/imports.ts" },
    { ...files[1], filename: "src/imports.test.ts" },
    { filename: "src/notes.ts", patch: "+// import an optional package" },
  ])
    assert.ok(visualSkipReason(visualRequirements([file], 2)));
  assert.equal(visualRequirements([files[0]], 2).dependency, true);
  assert.match(
    visualPrompt(requirements),
    /runtime, development, peer, optional and builtin/,
  );
  assert.match(
    visualPrompt(requirements),
    /do not infer transitive edges or runtime resolution/,
  );
  assert.match(visualPrompt(requirements), /install packages/);
});

test("dependency maps share the opt-in contract, safe flowchart validation and visual cap", async () => {
  assert.throws(
    () => validateVisualAnalysis(visuals),
    /supported diagram kind/,
  );
  validateVisualAnalysis(visuals, 2);
  assert.deepEqual(await sanitizeVisuals(visuals, requirements), visuals);
  const config = { ...(await fixture("config.visuals.json")), visualPhase: 2 };
  const markdown = renderReview(config, visuals, run);
  assert.match(markdown, /## PR Visuals[\s\S]*Declared service dependencies/);
  assert.doesNotMatch(markdown, /## Findings/);
  for (const mermaid of [
    "flowchart LR\n A-->",
    "sequenceDiagram\n A->>B: hi",
    "flowchart LR\n A-->B\n click A https://example.com",
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
  assert.equal(
    (
      await sanitizeVisuals(
        { ...visuals, diagrams: [...visuals.diagrams, ...visuals.diagrams] },
        requirements,
      )
    ).diagrams.length,
    1,
  );
});

test("base evidence reads exact frozen paths/refs and bounds renamed, added, removed and missing files", async () => {
  const identity = {
    repository: "Pocket-Trash/example",
    baseSha: "b".repeat(40),
    headSha: "a".repeat(40),
  };
  const fetch = async (url) => {
    assert.match(
      url,
      new RegExp(`contents/old%2Fpackage.json\\?ref=${identity.baseSha}$`),
    );
    return new Response(
      JSON.stringify({
        encoding: "base64",
        content: Buffer.from(files[0].baseContent).toString("base64"),
        size: 128,
      }),
    );
  };
  const result = await loadBaseEvidence(
    identity,
    { ...files[0], previous_filename: "old/package.json", status: "renamed" },
    "fixture-token",
    1024,
    fetch,
  );
  assert.equal(result.baseContent, files[0].baseContent);
  assert.equal(result.baseSha, identity.baseSha);
  assert.equal(result.headSha, identity.headSha);
  for (const [status, expected] of [
    ["added", ""],
    ["removed", files[0].content],
  ])
    assert.equal(
      (
        await loadBaseEvidence(
          identity,
          { ...files[0], status },
          "fixture-token",
          1024,
          async () => assert.fail("unexpected fetch"),
        )
      ).baseContent,
      expected,
    );
  assert.equal(
    await loadBaseEvidence(
      identity,
      files[0],
      "fixture-token",
      1024,
      async () => new Response(null, { status: 404 }),
    ),
    null,
  );
  assert.equal(
    await loadBaseEvidence(
      identity,
      { ...files[0], previous_filename: "old/package.json" },
      "fixture-token",
      1,
      fetch,
    ),
    null,
  );
  await assert.rejects(
    loadRepositoryFile(identity, "../outside", "fixture-token", async () =>
      assert.fail("unsafe fetch"),
    ),
    /unsafe/,
  );
  await assert.rejects(
    loadRepositoryFile(
      identity,
      "package.json",
      "fixture-token",
      async () => assert.fail("unfrozen fetch"),
      1024,
      "main",
    ),
    /frozen/,
  );
});

test("base evidence is materialized as plain text rather than a truncated JSON line", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dependency-evidence-"));
  try {
    const baseContent = `${"base declaration\n".repeat(500)}last base declaration`;
    await writeFile(
      join(directory, "pull-request.json"),
      JSON.stringify({ files: [{ ...files[0], baseContent }] }),
    );
    await materializeReviewEvidence(directory);
    const context = JSON.parse(
      await readFile(join(directory, "pull-request.json"), "utf8"),
    );
    assert.equal(context.files[0].baseContent, undefined);
    assert.equal(
      await readFile(join(directory, context.files[0].baseContentFile), "utf8"),
      baseContent,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("valid dependency syntax cannot establish transitive, invented or wrongly classified runtime edges", async () => {
  const scope = {
    ...requirements,
    visualPhase: 2,
    baseSha: "b".repeat(40),
    headSha: "a".repeat(40),
  };
  const row = {
    task: "visuals",
    visualPhase: 2,
    status: "success",
    id: "dependency-fixture",
    baseSha: scope.baseSha,
    headSha: scope.headSha,
    contextFormat: "plain-text-v1",
    validatorFormat: "node-dom-v1",
    outputFormat: "final-message-v1",
    review: visuals,
    latencyMs: 1000,
    usage: run.usage,
    selectedSkills: ["i-have-adhd", "stop-slop"],
    skillOverrides: [],
    billingStatus: "complete",
  };
  const assessment = {
    sourceAccuracy: "pass",
    coverageAccuracy: "pass",
    generatedArtifactOmission: "pass",
    diagramSemantics: "pass",
    stableTelemetry: "pass",
    fullToolLoop: "pass",
    toolBoundaryBehavior: "held",
    falseVisualClaims: [],
    evidence: [
      "Frozen package.json declares queue as dependencies, Vitest as devDependencies and React as peerDependencies.",
    ],
    notes: "No package installation or resolver execution.",
  };
  assert.equal(
    (await evaluateVisualTrial(row, scope, assessment)).passes,
    true,
  );
  assert.equal(
    (await sanitizeVisuals(unsupported, requirements)).diagrams.length,
    1,
  );
  assert.equal(
    (
      await evaluateVisualTrial({ ...row, review: unsupported }, scope, {
        ...assessment,
        sourceAccuracy: "fail",
        diagramSemantics: "fail",
        falseVisualClaims: [
          "Vitest is a development dependency; no database edge is declared.",
        ],
      })
    ).passes,
    false,
  );
});
