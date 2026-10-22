import assert from "node:assert/strict";
import test from "node:test";
import { buildRelationshipCatalog } from "../src/relationships.mjs";
import {
  buildVisualFacts,
  validateFactSelection,
  completeFactVisuals,
  focusVisualCandidates,
} from "../src/visual-facts.mjs";
import { prepareDeclarationBaseEvidence } from "../src/intake.mjs";
import { runRestrictedReview } from "../src/opencode.mjs";
import { fileURLToPath } from "node:url";

const identity = {
  repository: "Pocket-Trash/example",
  headSha: "a".repeat(40),
  baseSha: "b".repeat(40),
};
function fixture(files) {
  const context = { identity, files };
  const catalog = buildRelationshipCatalog(context);
  catalog.facts = buildVisualFacts(context, catalog);
  return catalog;
}
const file = (content, baseContent) => ({
  filename: "schema.ts",
  content,
  baseContent,
  baseSha: "c".repeat(40),
});
const diagram = (catalog, kind = "architecture") => ({
  kind,
  ...(kind === "schema-er"
    ? {
        entityIds: catalog.nodes
          .filter((n) => n.kind === "entity")
          .map((n) => n.id),
      }
    : {}),
  relationshipIds: catalog.relationships
    .filter((e) =>
      kind === "architecture"
        ? e.kind === "source-call"
        : e.kind === "foreign-key",
    )
    .map((e) => e.id),
});

test("frozen declaration facts distinguish new, text-modified, unchanged and uncertain source", () => {
  const catalog = fixture([
    file(
      "const old=1;\nfunction changed(){return 2;}\nconst added=3;",
      "const old=1;\nfunction changed(){return 1;}",
    ),
  ]);
  assert.deepEqual(
    Object.fromEntries(catalog.facts.map((f) => [f.symbol, f.status])),
    { old: "unchanged", changed: "modified", added: "added" },
  );
  for (const fact of catalog.facts)
    assert.equal(fact.source.sha, identity.headSha);
  const unknown = fixture([
    { filename: "code.ts", content: "const existing=1;" },
  ]);
  assert.equal(unknown.facts[0].status, "uncertain");
  const ambiguous = fixture([
    file(
      "function use(){const x=1;}",
      "function a(){const x=1;} function b(){const x=2;}",
    ),
  ]);
  assert.equal(
    ambiguous.facts.find((f) => f.symbol === "x").status,
    "uncertain",
  );
});

test("table facts use the actual literal table declaration, including single quotes", () => {
  const source =
    "import {pgTable,bigint} from 'drizzle-orm/pg-core';\nconst old=pgTable('existing',{id:bigint('id').primaryKey()});\nconst fresh=pgTable('new_table',{id:bigint('id').primaryKey()});";
  const catalog = fixture([
    file(source, source.split("\n").slice(0, 2).join("\n")),
  ]);
  assert.equal(
    catalog.facts.find((f) => f.kind === "entity" && f.symbol === "old").status,
    "unchanged",
  );
  assert.equal(
    catalog.facts.find((f) => f.kind === "entity" && f.symbol === "fresh")
      .status,
    "added",
  );
});

test("renamed table bindings are not misreported as new tables", () => {
  const prefix = "import {pgTable,bigint} from 'drizzle-orm/pg-core';\n";
  const catalog = fixture([
    file(
      prefix +
        "const renamed=pgTable('retained',{id:bigint('id').primaryKey()});",
      prefix + "const old=pgTable('retained',{id:bigint('id').primaryKey()});",
    ),
  ]);
  assert.equal(
    catalog.facts.find((f) => f.kind === "entity").status,
    "modified",
  );
});

test("removed declaration citations refer to frozen before-source, not head", () => {
  const catalog = fixture([
    { ...file("const removed=1;", "const removed=1;"), status: "removed" },
  ]);
  assert.equal(catalog.facts[0].status, "removed");
  assert.equal(catalog.facts[0].source.sha, "c".repeat(40));
});

test("Phase 1 cannot bypass evidence-backed prose with a missing frozen identity", async () => {
  await assert.rejects(
    runRestrictedReview({
      task: "visuals",
      apiKey: "fixture",
      model: "fixture",
      workspace: fileURLToPath(new URL("fixtures/workspace", import.meta.url)),
      visualRequirements: { architecture: true, schema: "none" },
      execute: async () => assert.fail("must fail before inference"),
    }),
    /require frozen base\/head/,
  );
});

test("prose protocol rejects arbitrary summaries, citations, fake and duplicate facts", () => {
  const catalog = fixture([file('const queue=service("queue");', "")]);
  const value = {
    factIds: [catalog.facts[0].id],
    diagrams: [diagram(catalog)],
  };
  for (const bad of [
    { ...value, overview: "four new tables; closes on failure" },
    { ...value, citations: ["patch:50"] },
    { ...value, factIds: ["fake"] },
    { ...value, factIds: [value.factIds[0], value.factIds[0]] },
  ])
    assert.throws(
      () => validateFactSelection(bad, catalog),
      /Invalid visual fact/,
    );
  assert.doesNotMatch(
    JSON.stringify(validateFactSelection(value, catalog)),
    /Invented exclusivity/,
  );
});

test("final host prose and citations cannot describe discarded architecture or invented constraints", async () => {
  const source =
    "import {pgTable,bigint} from 'drizzle-orm/pg-core';\nconst parent=pgTable('parent',{id:bigint('id').primaryKey()});\nconst child=pgTable('child',{id:bigint('id').primaryKey(),parentId:bigint('parent_id').references(()=>parent.id)});";
  const catalog = fixture([file(source, source)]);
  const selected = {
    factIds: catalog.facts.filter((f) => f.kind === "entity").map((f) => f.id),
    diagrams: [
      diagram(catalog, "schema-er"),
      {
        kind: "architecture",
        title: "Architecture is present",
        nodeIds: [],
        relationshipIds: [],
      },
    ],
  };
  const result = await completeFactVisuals(
    { value: selected },
    {
      catalog,
      requirements: { architecture: false, schema: "small" },
      phase: 1,
      repairVisuals: false,
      report: () => {},
    },
  );
  assert.equal(result.review.diagrams.length, 1);
  assert.match(result.review.overview, /1 validated source diagram/);
  assert.match(
    result.review.changedAreas[0].summary,
    /unchanged declaration shown as context/,
  );
  assert.match(
    result.review.changedAreas[0].summary,
    new RegExp(`schema.ts:2-2 at SHA ${identity.headSha}`),
  );
  assert.match(result.review.coverageGaps.join("\n"), /retained schema-er/);
  assert.match(
    result.review.coverageGaps.join("\n"),
    /omitted from the diagrams, not absent/,
  );
  assert.doesNotMatch(
    JSON.stringify(result.review),
    /Architecture is present|Invented exclusivity|closes on failure/,
  );
  assert.match(
    result.review.coverageGaps.join("\n"),
    /CHECK\/trigger semantics.*unassessed/,
  );
});

test("bounded repair regenerates final prose without carrying failed-attempt claims", async () => {
  const catalog = fixture([file('const queue=service("queue");', "")]);
  let calls = 0;
  const result = await completeFactVisuals(
    { value: { factIds: [], diagrams: [] } },
    {
      catalog,
      requirements: { architecture: true, schema: "none" },
      phase: 1,
      repairVisuals: true,
      report: () => {},
      invoke: async () => {
        calls++;
        return {
          value: {
            factIds: [catalog.facts[0].id],
            diagrams: [diagram(catalog)],
          },
        };
      },
    },
  );
  assert.equal(calls, 1);
  assert.match(result.review.overview, /1 validated source diagram/);
  assert.match(result.review.changedAreas[0].summary, /added declaration/);
  assert.doesNotMatch(
    result.review.coverageGaps.join("\n"),
    /had no valid architecture/,
  );
});

test("before evidence uses the frozen comparison merge-base and rename path, not branch tip", async () => {
  const mergeBase = "c".repeat(40),
    prepared = {
      files: [
        {
          filename: "renamed.ts",
          previous_filename: "old.ts",
          status: "renamed",
          content: "const retained=1;",
        },
      ],
      omissions: [],
    };
  await prepareDeclarationBaseEvidence(
    prepared,
    identity,
    mergeBase,
    "fixture",
    524288,
    async (url) => {
      assert.match(url, new RegExp(`contents/old.ts\\?ref=${mergeBase}$`));
      assert.ok(!url.includes(identity.baseSha));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          encoding: "base64",
          size: 17,
          content: Buffer.from("const retained=1;").toString("base64"),
        }),
      };
    },
  );
  assert.equal(prepared.files[0].baseSha, mergeBase);
  const missing = {
    files: [{ filename: "code.ts", content: "const old=1;" }],
    omissions: [],
  };
  await prepareDeclarationBaseEvidence(
    missing,
    identity,
    undefined,
    "fixture",
    524288,
    () => {
      throw Error("must not guess a baseline");
    },
  );
  assert.match(missing.omissions[0], /change status is uncertain/);
});

test("relationship-only selection derives both endpoints and rejects unknown/duplicate/wrong-kind IDs", async () => {
  const source =
    "import {pgTable,bigint} from 'drizzle-orm/pg-core';\nconst parent=pgTable('parent',{id:bigint('id').primaryKey()});\nconst child=pgTable('child',{id:bigint('id').primaryKey(),parentId:bigint('parent_id').references(()=>parent.id)});";
  const catalog = fixture([file(source, source)]),
    fk = catalog.relationships.find((e) => e.kind === "foreign-key");
  const normalized = validateFactSelection(
    {
      factIds: [],
      diagrams: [{ kind: "schema-er", relationshipIds: [fk.id] }],
    },
    catalog,
  );
  assert.deepEqual(
    new Set(normalized.diagrams[0].nodeIds),
    new Set([fk.from, fk.to]),
  );
  for (const bad of [
    { kind: "schema-domain", relationshipIds: ["made-up"] },
    { kind: "schema-domain", relationshipIds: [fk.id, fk.id] },
    { kind: "architecture", relationshipIds: [fk.id] },
    { kind: "schema-domain", relationshipIds: [] },
    { kind: "schema-er", relationshipIds: [], entityIds: ["missing"] },
    { kind: "schema-er", relationshipIds: [fk.id], nodeIds: [fk.from] },
    {
      kind: "schema-er",
      relationshipIds: [fk.id],
      title: "Mandatory nullable relationship",
    },
  ]) {
    await assert.rejects(
      completeFactVisuals(
        { value: { factIds: [], diagrams: [bad] } },
        {
          catalog,
          requirements: { architecture: false, schema: "large" },
          phase: 1,
          repairVisuals: false,
          report: () => {},
        },
      ),
      (e) => e.code === "VISUAL_REQUIRED_MISSING",
    );
  }
  const isolated = validateFactSelection(
    {
      factIds: [],
      diagrams: [
        { kind: "schema-er", relationshipIds: [], entityIds: [fk.from] },
      ],
    },
    catalog,
  );
  assert.deepEqual(isolated.diagrams[0].nodeIds, [fk.from]);
});

test("derived selection enforces endpoint and edge ceilings before Mermaid rendering", () => {
  const nodes = Array.from({ length: 66 }, (_, i) => ({
    id: `n${i}`,
    kind: "code",
  }));
  const relationships = Array.from({ length: 65 }, (_, i) => ({
    id: `r${i}`,
    kind: "source-call",
    from: "n0",
    to: `n${i + 1}`,
  }));
  const catalog = { nodes, relationships, facts: [] };
  for (const count of [32, 65]) {
    const selected = validateFactSelection(
      {
        factIds: [],
        diagrams: [
          {
            kind: "architecture",
            relationshipIds: relationships.slice(0, count).map((e) => e.id),
          },
        ],
      },
      catalog,
    );
    assert.equal(selected.diagrams[0].nodeIds.length, 0);
  }
  const bounded = validateFactSelection(
    {
      factIds: [],
      diagrams: [
        {
          kind: "architecture",
          relationshipIds: relationships.slice(0, 31).map((e) => e.id),
        },
      ],
    },
    catalog,
  );
  assert.equal(bounded.diagrams[0].nodeIds.length, 32);
});

test("change-focused candidates prioritize changed owners, retain isolated ER context and disclose exclusions", () => {
  const source = Array.from(
    { length: 100 },
    (_, i) => `function old${i}(){return call${i}();}`,
  ).join("\n");
  const catalog = fixture([
    file(source + "\nfunction fresh(){return newCall();}", source),
  ]);
  const original = JSON.stringify(catalog),
    focused = focusVisualCandidates(catalog);
  const fresh = catalog.facts.find((f) => f.symbol === "fresh");
  assert.ok(focused.nodes.some((n) => n.id === fresh.nodeId));
  assert.ok(focused.relationships.some((e) => e.from === fresh.nodeId));
  assert.ok(focused.nodes.filter((n) => n.kind === "code").length <= 64);
  assert.ok(
    focused.relationships.filter((e) => e.kind === "source-call").length <= 64,
  );
  assert.match(
    focused.omissions.at(-1),
    /supplied source files remain available/,
  );
  assert.ok(Buffer.byteLength(JSON.stringify(focused)) < 255 * 1024);
  assert.equal(JSON.stringify(catalog), original);
  const schema = fixture([
    file(
      "import {pgTable,bigint} from 'drizzle-orm/pg-core'; const isolated=pgTable('isolated',{id:bigint('id').primaryKey()});",
      "",
    ),
  ]);
  assert.ok(
    focusVisualCandidates(schema).nodes.some((n) => n.kind === "entity"),
  );
});

test("fact-only selection rejects invented prose in every narrative field", () => {
  const catalog = fixture([file("const retained=1;", "const retained=1;")]);
  for (const claim of [
    "A nullable account reference requires exactly one account.",
    "The deployment now routes all traffic through a new queue.",
    "Two unique columns form a composite primary key.",
  ]) {
    for (const extra of [
      { overview: claim },
      { coverageGaps: [claim] },
      { changedAreas: [{ area: "schema", summary: claim }] },
    ]) {
      assert.throws(
        () =>
          validateFactSelection(
            { factIds: [], diagrams: [], ...extra },
            catalog,
          ),
        /Invalid visual fact/,
      );
    }
  }
});

test("candidate byte trimming keeps references closed and records scope loss", () => {
  const nodes = Array.from({ length: 100 }, (_, i) => ({
    id: `n${i}`,
    kind: "code",
    label: "x".repeat(8000),
  }));
  const relationships = nodes.slice(1).map((n, i) => ({
    id: `r${i}`,
    kind: "source-call",
    from: "n0",
    to: n.id,
  }));
  const focused = focusVisualCandidates({
    nodes,
    relationships,
    facts: [],
    omissions: [],
  });
  assert.ok(Buffer.byteLength(JSON.stringify(focused)) < 255 * 1024);
  const ids = new Set(focused.nodes.map((n) => n.id));
  assert.ok(
    focused.relationships.every((e) => ids.has(e.from) && ids.has(e.to)),
  );
  assert.match(focused.omissions[0], /candidate set omitted/);
});
