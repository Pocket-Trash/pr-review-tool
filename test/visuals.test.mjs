import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  sanitizeVisuals,
  visualPrompt,
  visualRequirements,
} from "../src/visuals.mjs";

const fixture = async (number) =>
  JSON.parse(
    await readFile(
      new URL(`fixtures/pulls/${number}.json`, import.meta.url),
      "utf8",
    ),
  );
const baseReview = { findings: [], changedAreas: [], coverageGaps: [] };

test("PR 403 requests change-focused architecture output", async () => {
  const requirements = visualRequirements(await fixture(403));
  assert.deepEqual(requirements, { architecture: true, schema: "none" });
  assert.match(visualPrompt(requirements), /architecture flowchart/);
});

test("architecture eligibility covers material infrastructure without test-file false positives", () => {
  for (const filename of [
    "Dockerfile.api",
    ".github/workflows/deploy.yml",
    "wrangler.toml",
    "k8s/deployment.yml",
  ])
    assert.equal(
      visualRequirements([{ filename, additions: 1, deletions: 0 }])
        .architecture,
      true,
      filename,
    );
  assert.equal(
    visualRequirements([
      { filename: "src/queue.test.ts", additions: 200, deletions: 0 },
      {
        filename: "packages/queue/test/queue.test.ts",
        additions: 200,
        deletions: 0,
      },
    ]).architecture,
    false,
  );
  assert.equal(
    visualRequirements([
      {
        filename: "apps/worker/src/consumer.ts",
        additions: 55,
        deletions: 0,
      },
    ]).architecture,
    true,
  );
});

test("PR 354 requests a domain map and focused ER slice", async () => {
  const requirements = visualRequirements(await fixture(354));
  assert.equal(requirements.schema, "large");
  assert.match(visualPrompt(requirements), /schema-domain flowchart/);
  assert.match(visualPrompt(requirements), /schema-er erDiagram/);
  assert.match(visualPrompt(requirements), /omitted tables or relationships/);
});

test("a focused source schema change is classified as small", () => {
  assert.equal(
    visualRequirements([
      {
        filename: "packages/database/src/schema/account.ts",
        additions: 25,
        deletions: 2,
      },
    ]).schema,
    "small",
  );
});

test("PR 376 never requests a UI screenshot", async () => {
  const prompt = visualPrompt(visualRequirements(await fixture(376)));
  assert.doesNotMatch(prompt, /screenshot|sequence|state|package dependency/i);
});

test("valid eligible architecture and schema diagrams are retained", async () => {
  const review = await sanitizeVisuals(
    {
      ...baseReview,
      diagrams: [
        {
          kind: "architecture",
          title: "Staged queue",
          mermaid:
            'flowchart LR\n  subgraph Current["Current production"]\n    Producer["Scraper producers"] --> Queue["Existing queue"]\n  end',
        },
        {
          kind: "schema-er",
          title: "Pens",
          mermaid: "erDiagram\n  BRAND ||--o{ PEN : makes",
        },
      ],
    },
    { architecture: true, schema: "small" },
  );
  assert.equal(review.diagrams.length, 2);
  assert.deepEqual(review.coverageGaps, []);
});

test("unsafe and invalid Mermaid is omitted into coverage gaps", async () => {
  for (const mermaid of [
    "flowchart LR\n click A https://example.com",
    "flowchart LR; A-->B; click A callback",
    "%%{init: {}}%%\nflowchart LR\n A-->B",
    "flowchart LR\n A[<b>raw</b>]",
    "flowchart LR\n A --> https://example.com",
    'flowchart LR\n A@{ img: "//example.com/image.png" }',
    "flowchart LR\n A -->",
  ]) {
    const review = await sanitizeVisuals(
      {
        ...baseReview,
        diagrams: [{ kind: "architecture", title: "Unsafe", mermaid }],
      },
      { architecture: true, schema: "none" },
    );
    assert.equal(review.diagrams.length, 0);
    assert.ok(
      review.coverageGaps.some((gap) => gap.includes("Omitted Unsafe")),
    );
  }
});

test("diagram cap prioritizes required large-schema kinds after validation", async () => {
  const diagram = (index) => ({
    kind: "schema-er",
    title: `Slice ${index}`,
    mermaid: `erDiagram\n  A${index} ||--o{ B${index} : has`,
  });
  const review = await sanitizeVisuals(
    {
      ...baseReview,
      diagrams: [
        ...Array.from({ length: 4 }, (_, index) => diagram(index)),
        {
          kind: "schema-er",
          title: "Invalid",
          mermaid: "erDiagram\n BROKEN ||--",
        },
        {
          kind: "schema-domain",
          title: "Domains",
          mermaid: "flowchart LR\n Catalog --> Inventory",
        },
      ],
    },
    { architecture: false, schema: "large" },
  );
  assert.equal(review.diagrams.length, 3);
  assert.equal(review.diagrams[0].kind, "schema-domain");
  assert.equal(
    review.diagrams.filter(({ kind }) => kind === "schema-er").length,
    2,
  );
  assert.ok(review.coverageGaps.some((gap) => gap.includes("visual-scope")));
  assert.ok(
    !review.coverageGaps.some((gap) => gap.includes("no valid domain map")),
  );
});
