import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRestrictedReview } from "../src/opencode.mjs";

const architecture = {
  kind: "architecture",
  title: "Original",
  mermaid: "flowchart LR\n A --> B",
};
const er = {
  kind: "schema-er",
  title: "Entities",
  mermaid: "erDiagram\n parent ||--o{ child : has",
};
const value = (diagrams) => ({
  overview: "Original prose.",
  diagrams,
  changedAreas: [],
  coverageGaps: ["Source target definition is not supplied."],
});
const output = (review) => ({
  stdout: [
    {
      type: "step_finish",
      part: { tokens: { input: 10, output: 5 }, cost: 0.01 },
    },
    { type: "text", part: { text: JSON.stringify(review) } },
  ]
    .map((event) => JSON.stringify(event))
    .join("\n"),
});
const options = {
  task: "visuals",
  visualPhase: 2,
  apiKey: "fixture",
  model: "fixture",
  provider: "openrouter",
  workspace: fileURLToPath(new URL("fixtures/workspace", import.meta.url)),
  visualRequirements: { architecture: true, schema: "none" },
  maxTransientRetries: 0,
  repairVisuals: true,
};

test("repair rechecks runner-owned relationship IDs before rendering", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "relationship-repair-"));
  try {
    await writeFile(
      join(workspace, "pull-request.json"),
      JSON.stringify({
        identity: { headSha: "a".repeat(40), baseSha: "b".repeat(40) },
        files: [
          { filename: "queue.ts", content: 'const queue=service("queue");' },
        ],
      }),
    );
    for (const invent of [true, false]) {
      let calls = 0;
      let validation;
      const run = runRestrictedReview({
        ...options,
        visualPhase: 1,
        workspace,
        onVisualValidation: (report) => {
          validation = report;
        },
        execute: async (_command, _args, settings) => {
          calls++;
          if (calls === 1) return output({ factIds: [], diagrams: [] });
          const catalog = JSON.parse(
            await readFile(
              join(settings.cwd, "review-relationships.json"),
              "utf8",
            ),
          );
          const edge = catalog.relationships[0];
          return output({
            factIds: [],
            diagrams: [
              {
                kind: "architecture",
                relationshipIds: [invent ? "invented" : edge.id],
              },
            ],
          });
        },
      });
      if (invent) {
        await assert.rejects(
          run,
          (error) => error.code === "VISUAL_REQUIRED_MISSING",
        );
        assert.equal(
          validation.attempts.at(-1).diagnostics[0].reason,
          "Invalid evidence diagram selection",
        );
      } else {
        const result = await run;
        assert.match(result.diagrams[0].mermaid, /source-call/);
      }
      assert.equal(calls, 2);
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("one repair replaces unsafe required diagrams without changing successful content or source gaps", async () => {
  let calls = 0;
  const usage = [];
  const reports = [];
  const timeouts = [];
  const result = await runRestrictedReview({
    ...options,
    visualRequirements: { architecture: true, schema: "small" },
    onUsage: (u) => usage.push(u),
    onVisualValidation: (r) => reports.push(structuredClone(r)),
    execute: async (_command, args, settings) => {
      timeouts.push(settings.timeout);
      calls++;
      if (calls === 1)
        return output(
          value([
            architecture,
            {
              ...er,
              mermaid: 'erDiagram\n parent {\n string html "<b>bad</b>"\n }',
            },
          ]),
        );
      assert.match(args.at(-1), /One bounded repair pass only/);
      return output({
        ...value([er, { ...architecture, title: "Overwrite" }]),
        overview: "Overwrite",
        coverageGaps: [],
      });
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.overview, "Original prose.");
  assert.deepEqual(result.diagrams, [architecture, er]);
  assert.equal(
    result.coverageGaps.filter((gap) =>
      gap.includes("Source target definition"),
    ).length,
    1,
  );
  assert.ok(
    !result.coverageGaps.some((gap) => /no valid|unsafe Mermaid/.test(gap)),
  );
  assert.equal(
    usage.reduce((sum, u) => sum + u.estimatedCostUsd, 0),
    0.02,
  );
  assert.equal(reports.at(-1).attempts.length, 2);
  assert.ok(timeouts[1] <= timeouts[0]);
});

test("persistent syntax or evidence failures get one repair then a structured failure", async () => {
  for (const diagram of [
    { ...architecture, mermaid: "not mermaid" },
    {
      kind: "architecture",
      title: "Invented",
      nodeIds: ["invented"],
      relationshipIds: ["fake"],
    },
  ]) {
    let calls = 0;
    await assert.rejects(
      runRestrictedReview({
        ...options,
        execute: async () => {
          calls++;
          return output(value([diagram]));
        },
      }),
      (error) =>
        error.code === "VISUAL_REQUIRED_MISSING" &&
        error.diagnostics.length === 2,
    );
    assert.equal(calls, 2);
  }
});

test("live repair stays opt-in and missing required visuals never succeed via a coverage warning", async () => {
  let calls = 0;
  await assert.rejects(
    runRestrictedReview({
      ...options,
      repairVisuals: false,
      execute: async () => {
        calls++;
        return output(value([]));
      },
    }),
    (error) => error.code === "VISUAL_REQUIRED_MISSING",
  );
  assert.equal(calls, 1);
});

test("whole-output repair refreshes failed prose but retains historical source claims", async () => {
  let calls = 0;
  const result = await runRestrictedReview({
    ...options,
    execute: async (_command, args) => {
      calls++;
      if (calls === 1)
        return output({
          ...value([]),
          overview: "No diagram could be produced.",
        });
      assert.match(args.at(-1), /Refresh its failed overview/);
      return output({
        overview: "Declared queue source calls.",
        diagrams: [architecture],
        changedAreas: [{ area: "Queue", summary: "Declares a queue." }],
        coverageGaps: ["Runtime deployment was not inspected."],
      });
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.overview, "Declared queue source calls.");
  assert.equal(result.changedAreas.length, 1);
  assert.ok(
    result.coverageGaps.some(
      (gap) =>
        gap.startsWith(
          "Initial-attempt analytical claim (superseded after repair, unverified):",
        ) && gap.includes("Source target definition"),
    ),
  );
  assert.ok(
    result.coverageGaps.some(
      (gap) =>
        gap.startsWith("Repair model-reported") &&
        gap.includes("Runtime deployment"),
    ),
  );
});

test("repair cannot reset the deadline or retry an unaffordable/cancelled request", async () => {
  let calls = 0;
  await assert.rejects(
    runRestrictedReview({
      ...options,
      timeoutMs: 100,
      execute: async () => {
        calls++;
        await new Promise((resolve) => setTimeout(resolve, 150));
        return output(value([]));
      },
    }),
    /timed out/,
  );
  assert.ok(calls <= 1);
  for (const message of [
    "Budget reservation would exceed cap",
    "Session capability revoked",
  ]) {
    calls = 0;
    await assert.rejects(
      runRestrictedReview({
        ...options,
        execute: async () => {
          calls++;
          if (calls === 2) throw new Error(message);
          return output(value([]));
        },
      }),
      new RegExp(message),
    );
    assert.equal(calls, 2);
  }
});
