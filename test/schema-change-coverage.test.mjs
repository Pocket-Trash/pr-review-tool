import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRelationshipCatalog,
  renderEvidenceVisuals,
} from "../src/relationships.mjs";
import {
  buildVisualFacts,
  completeFactVisuals,
  focusVisualCandidates,
} from "../src/visual-facts.mjs";
const identity = { headSha: "a".repeat(40), baseSha: "b".repeat(40) };
const prefix = `import {pgTable,bigint} from 'drizzle-orm/pg-core';`;
const base =
  prefix +
  `export const periods=pgTable('periods',{id:bigint('id').primaryKey()});`;
const content =
  prefix +
  `import {currency} from './settings.js'; export const periods=pgTable('periods',{id:bigint('id').primaryKey(),paid:bigint('paid'),code:currency('code')});`;
const context = () => ({
  identity,
  files: [
    {
      filename: "schema.ts",
      content,
      baseContent: base,
      baseSha: identity.baseSha,
    },
    {
      filename: "settings.ts",
      status: "context",
      content: `import {pgEnum} from 'drizzle-orm/pg-core'; export const currency=pgEnum('currency',['USD','CAD']);`,
    },
  ],
});
test("imported enum columns keep the changed table and its non-key fields visible", () => {
  const catalog = buildRelationshipCatalog(context());
  const table = catalog.nodes.find((n) => n.name === "periods");
  assert.ok(table);
  const diagram = renderEvidenceVisuals(
    {
      diagrams: [
        {
          kind: "schema-er",
          title: "Prices",
          nodeIds: [table.id],
          relationshipIds: [],
        },
      ],
    },
    catalog,
  ).diagrams[0];
  assert.match(diagram.mermaid, /bigint paid/);
  assert.match(diagram.mermaid, /currency code/);
});
test("an unchanged entity cannot satisfy required changed-schema coverage", async () => {
  const c = context();
  c.files[0].content += `export const other=pgTable('other',{id:bigint('id').primaryKey()});`;
  c.files[0].baseContent += `export const other=pgTable('other',{id:bigint('id').primaryKey()});`;
  const catalog = buildRelationshipCatalog(c);
  catalog.facts = buildVisualFacts(c, catalog);
  const other = catalog.nodes.find((n) => n.name === "other");
  await assert.rejects(
    completeFactVisuals(
      {
        value: {
          factIds: [],
          diagrams: [
            { kind: "schema-er", entityIds: [other.id], relationshipIds: [] },
          ],
        },
      },
      {
        catalog,
        requirements: { architecture: false, schema: "small" },
        phase: 1,
        repairVisuals: false,
        report: () => {},
      },
    ),
    /missing|unsupported/i,
  );
});

test("schema imports are bounded and preserve enum declarations across two frozen source hops", async () => {
  const { prepareSchemaContext } = await import("../src/schema-context.mjs");
  const c = context();
  c.files = [c.files[0]];
  c.files[0].filename = "schema/collection.ts";
  const modules = new Map([
    [
      "schema/settings.ts",
      `import {pgEnum} from 'drizzle-orm/pg-core'; import {codes} from './enums.js'; export const currency=pgEnum('currency',codes);`,
    ],
    ["schema/enums.ts", `export const codes=['USD','CAD'] as const;`],
  ]);
  let reads = 0;
  const prepared = { files: c.files, omissions: [] };
  await prepareSchemaContext(
    prepared,
    identity,
    async (path, sha) => {
      reads++;
      assert.equal(sha, identity.headSha);
      return modules.has(path)
        ? { filename: path, content: modules.get(path) }
        : null;
    },
    { maxFiles: 10, maxBytes: 10000, maxFileBytes: 5000 },
  );
  assert.ok(reads <= 64);
  assert.ok(
    buildRelationshipCatalog({ identity, files: prepared.files }).nodes.some(
      (n) => n.name === "periods",
    ),
  );
  assert.ok(
    prepared.files
      .filter((f) => f.status === "context")
      .every((f) => f.baseContent === undefined),
  );
});
test("unsupported changed declarations stop before any model invocation", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { runRestrictedReview } = await import("../src/opencode.mjs");
  const dir = await mkdtemp(join(tmpdir(), "schema-unknown-"));
  try {
    const c = context();
    c.files = c.files.slice(0, 1);
    await writeFile(join(dir, "pull-request.json"), JSON.stringify(c));
    await assert.rejects(
      runRestrictedReview({
        task: "visuals",
        apiKey: "fixture",
        model: "fixture",
        workspace: dir,
        visualRequirements: { architecture: false, schema: "small" },
        onInvocation: () =>
          assert.fail("no paid request for unsupported changed entity"),
        execute: async () => assert.fail("provider must not run"),
      }),
      /incomplete before inference/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("unavailable comparison source cannot silently remove changed entity requirements", () => {
  const c = context();
  delete c.files[0].baseContent;
  assert.equal(
    buildRelationshipCatalog(c).schemaChanges[0].status,
    "uncertain",
  );
});
test("unknown or cross-revision enum factories cannot prove a changed entity", () => {
  for (const content of [
    `export const currency=unknownFactory('currency',['USD']);`,
    `import {pgEnum} from 'drizzle-orm/pg-core'; export let currency=pgEnum('currency',['USD']);`,
    `import {pgEnum} from 'drizzle-orm/pg-core'; export const currency=pgEnum('currency',getCodes());`,
  ]) {
    const c = context();
    c.files[1].content = content;
    const catalog = buildRelationshipCatalog(c);
    assert.ok(
      catalog.schemaChanges.some((c) => c.name === "periods" && !c.nodeId),
    );
  }
  const c = context();
  c.files[1].evidenceSha = identity.baseSha;
  assert.ok(
    !buildRelationshipCatalog(c).nodes.some((n) => n.name === "periods"),
  );
});

test("changed dynamic column objects and removed declarations remain explicit requirements", () => {
  const old =
    prefix +
    `const a=pgTable('a',{id:bigint('id').primaryKey()}); const b=pgTable('b',{id:bigint('id').primaryKey()});`;
  for (const [content, status] of [
    [
      prefix +
        `const a=pgTable('a',cols); const b=pgTable('b',{id:bigint('id').primaryKey()});`,
      "modified",
    ],
    [
      prefix + `const b=pgTable('b',{id:bigint('id').primaryKey()});`,
      "modified",
    ],
    [old, "removed"],
  ]) {
    const c = buildRelationshipCatalog({
      identity,
      files: [
        {
          filename: "schema.ts",
          content,
          baseContent: old,
          baseSha: identity.baseSha,
          status,
        },
      ],
    });
    assert.ok(
      c.schemaChanges.some(
        (change) =>
          change.name === "a" &&
          (change.status === "removed" || !change.nodeId),
      ),
    );
  }
});
test("enum dependencies keep the exact frozen SHA in materialized evidence", async () => {
  const { materializeReviewEvidence } = await import("../src/workspace.mjs");
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const dir = await mkdtemp(join(tmpdir(), "schema-revision-"));
  try {
    const c = context();
    c.files[1].evidenceSha = identity.headSha;
    await writeFile(join(dir, "pull-request.json"), JSON.stringify(c));
    const inventory = await materializeReviewEvidence(dir);
    assert.equal(
      inventory.files.find((f) => f.filename === "settings.ts").sha,
      identity.headSha,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("changed isolated entities survive a catalogue full of unrelated relationships", () => {
  const c = context();
  const neighbors = Array.from(
    { length: 100 },
    (_, i) =>
      `const t${i}=pgTable('t${i}',{id:bigint('id').primaryKey(),parent:bigint('parent').references(()=>t${i ? i - 1 : 0}.id)});`,
  ).join("");
  c.files[0].content += neighbors;
  c.files[0].baseContent += neighbors;
  const catalog = buildRelationshipCatalog(c);
  catalog.facts = buildVisualFacts(c, catalog);
  const table = catalog.schemaChanges.find((c) => c.name === "periods");
  const focused = focusVisualCandidates(catalog);
  assert.ok(focused.nodes.some((node) => node.id === table.nodeId));
  assert.ok(focused.nodes.length < catalog.nodes.length);
});

test("rejected changed schema source cannot hide behind an unchanged neighboring table", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { runRestrictedReview } = await import("../src/opencode.mjs");
  const dir = await mkdtemp(join(tmpdir(), "schema-rejected-"));
  try {
    for (const content of [
      "@sealed class Marker {}" + base,
      " ".repeat(524288) + base,
    ]) {
      const c = {
        identity,
        files: [
          {
            filename: "schema/a.ts",
            content,
            baseContent: "",
            baseSha: identity.baseSha,
          },
          {
            filename: "schema/b.ts",
            content: base.replaceAll("periods", "unchanged"),
            baseContent: base.replaceAll("periods", "unchanged"),
            baseSha: identity.baseSha,
          },
        ],
      };
      await writeFile(join(dir, "pull-request.json"), JSON.stringify(c));
      await assert.rejects(
        runRestrictedReview({
          task: "visuals",
          apiKey: "fixture",
          model: "fixture",
          workspace: dir,
          visualRequirements: { architecture: false, schema: "small" },
          onInvocation: () =>
            assert.fail("rejected source must stop before inference"),
          execute: async () => assert.fail("provider must not run"),
        }),
        /incomplete before inference/,
      );
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
