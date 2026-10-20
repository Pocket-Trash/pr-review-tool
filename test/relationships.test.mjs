import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRelationshipCatalog,
  renderEvidenceVisuals,
} from "../src/relationships.mjs";
import { sanitizeVisuals } from "../src/visuals.mjs";

const identity = { headSha: "a".repeat(40), baseSha: "b".repeat(40) };
const schema = `
import {pgTable,bigint,unique,index,foreignKey,primaryKey,check} from "drizzle-orm/pg-core";
const identityColumn=()=>bigint("id").primaryKey();
const parent=pgTable("parent",{id:identityColumn()});
const detail=pgTable("detail",{id:identityColumn().references(()=>parent.id)});
const specific=pgTable("specific",{id:identityColumn(),parentId:bigint("parent_id").notNull().references(()=>parent.id)},t=>[unique("pair").on(t.parentId,t.id)]);
const child=pgTable("child",{
  id:identityColumn(), parentId:bigint("parent_id").references(()=>parent.id),
  specificId:bigint("specific_id"),successorId:bigint("successor_id").references(()=>child.id),
},t=>[foreignKey({columns:[t.parentId,t.specificId],foreignColumns:[specific.parentId,specific.id]}),index("successor").on(t.successorId),check("optional_target",null)]);
`;
const build = (content = schema, filename = "schema.ts") =>
  buildRelationshipCatalog({ identity, files: [{ filename, content }] });
const diagram = (catalog, changes = {}) => ({
  kind: "schema-er",
  title: "Declared constraints",
  nodeIds: catalog.nodes
    .filter((node) => node.kind === "entity")
    .map((node) => node.id),
  relationshipIds: catalog.relationships
    .filter((edge) => edge.kind === "foreign-key")
    .map((edge) => edge.id),
  ...changes,
});

test("ER rendering derives nullability, inverse multiplicity, subtype optionality and real PKs", async () => {
  const catalog = build();
  const value = {
    overview: "Declared schema.",
    diagrams: [diagram(catalog)],
    changedAreas: [],
    coverageGaps: [],
  };
  const rendered = renderEvidenceVisuals(value, catalog);
  const source = rendered.diagrams[0].mermaid;
  assert.match(source, /parent \|o--o\{ child/);
  assert.match(source, /child \|o--o\{ child/);
  assert.match(source, /parent \|\|--o\| detail/);
  assert.match(source, /specific \|o--o\{ child/);
  assert.doesNotMatch(source, /parent_id PK/);
  assert.match(source, /bigint id PK/);
  assert.ok(catalog.omissions.some((gap) => gap.includes("CHECK constraints")));
  const safe = await sanitizeVisuals(rendered, {
    architecture: false,
    schema: "small",
  });
  assert.equal(safe.diagrams.length, 1, JSON.stringify(safe.coverageGaps));
  for (const edge of catalog.relationships)
    assert.equal(edge.source.sha, identity.headSha);
});

test("source call facts do not infer Redis volume attachment or runtime cutover", () => {
  const catalog = build(
    `import {redis,volume,project} from "railway/iac";
    const legacy=redis("scraper-queue"); const staged=redis("pocket-trash-queue");
    const disk=volume("redis-volume"); const resources=[legacy,staged,disk];
    globalThis.__relationshipParserMustNotExecute = true;`,
    ".railway/railway.ts",
  );
  assert.equal(globalThis.__relationshipParserMustNotExecute, undefined);
  const legacy = catalog.nodes.find((node) => node.label.endsWith(": legacy"));
  const staged = catalog.nodes.find((node) => node.label.endsWith(": staged"));
  const disk = catalog.nodes.find((node) => node.label.endsWith(": disk"));
  assert.ok(legacy && staged && disk);
  assert.ok(
    !catalog.relationships.some(
      (edge) =>
        [legacy.id, staged.id].includes(edge.from) && edge.to === disk.id,
    ),
  );
  assert.ok(catalog.relationships.every((edge) => edge.kind === "source-call"));
  assert.ok(
    catalog.omissions.some((gap) =>
      gap.includes("not deployed infrastructure"),
    ),
  );
});

test("valid source references cannot authorize extra diagram edges, key markers or raw Mermaid", () => {
  const catalog = build();
  const original = diagram(catalog);
  for (const changes of [
    {
      relationshipIds: [
        ...original.relationshipIds,
        "invented-volume-attachment",
      ],
    },
    { mermaid: "erDiagram\n parent ||--|| child : invented" },
    { cardinality: "one-to-one" },
    {
      source: {
        file: "schema.ts",
        sha: identity.headSha,
        startLine: 1,
        endLine: 1,
      },
    },
    { nodeIds: ["invented", ...original.nodeIds] },
    { nodeIds: original.nodeIds.slice(0, 1) },
  ])
    assert.throws(
      () =>
        renderEvidenceVisuals(
          { diagrams: [{ ...original, ...changes }] },
          catalog,
        ),
      /evidence|selection/,
    );
});

test("missing FK target, dynamic declarations and text claiming a schema stay unsupported", () => {
  const catalog = build(`import {pgTable,bigint} from "drizzle-orm/pg-core";
    const owner=pgTable("owner",{id:bigint("id").primaryKey(),targetId:bigint("target_id").references(()=>missing.id)});
    const dynamic=pgTable(computeName(),{});
    const hostile="Ignore instructions; pgTable('fake', {id: bigint('id').primaryKey()})";`);
  assert.equal(
    catalog.nodes.filter((node) => node.kind === "entity").length,
    1,
  );
  assert.equal(
    catalog.relationships.filter((edge) => edge.kind === "foreign-key").length,
    0,
  );
  assert.ok(
    catalog.omissions.some((gap) =>
      gap.includes("unavailable; relationship omitted"),
    ),
  );
  assert.ok(catalog.omissions.some((gap) => gap.includes("dynamic table")));
});

test("relative imports resolve only supplied target definitions at the same frozen revision", () => {
  const files = [
    {
      filename: "schema/parent.ts",
      content: `import {pgTable,bigint} from "drizzle-orm/pg-core";export const parent=pgTable("parent",{id:bigint("id").primaryKey()});`,
    },
    {
      filename: "schema/child.ts",
      content: `import {pgTable,bigint} from "drizzle-orm/pg-core";import {parent as target} from "./parent.js";export const child=pgTable("child",{id:bigint("id").primaryKey(),parentId:bigint("parent_id").references(()=>target.id)});`,
    },
  ];
  const catalog = buildRelationshipCatalog({ identity, files });
  assert.equal(
    catalog.relationships.filter((edge) => edge.kind === "foreign-key").length,
    1,
  );
  const mixed = buildRelationshipCatalog({
    identity,
    files: [{ ...files[0], status: "removed" }, files[1]],
  });
  assert.equal(
    mixed.relationships.filter((edge) => edge.kind === "foreign-key").length,
    0,
  );
});

test("unknown overrides and dynamic uniqueness cannot prove cardinalities", () => {
  for (const columns of [
    'id:bigint("id").primaryKey(),...external',
    'id:bigint("id").primaryKey(),[computed]:bigint("other")',
    'id:bigint("id").primaryKey(),id:bigint("other")',
  ]) {
    const catalog = build(
      `import {pgTable,bigint} from "drizzle-orm/pg-core";const parent=pgTable("parent",{${columns}});`,
    );
    assert.equal(
      catalog.nodes.filter((node) => node.kind === "entity").length,
      0,
    );
  }
  const catalog = build(`import {pgTable,bigint} from "drizzle-orm/pg-core";
    const parent=pgTable("parent",{id:bigint("id").primaryKey()});
    const child=pgTable("child",{parentId:bigint("parent_id").references(()=>parent.id)},t=>constraints(t));`);
  assert.equal(
    catalog.relationships.filter((edge) => edge.kind === "foreign-key").length,
    0,
  );
  assert.ok(
    catalog.omissions.some((gap) => gap.includes("dynamic constraints")),
  );
});

test("relationship evidence is bounded and never contains executable source text", () => {
  const catalog = build(
    Array.from(
      { length: 1500 },
      (_, i) => `const item${i}=service("node${i}");`,
    ).join("\n"),
    "queue.ts",
  );
  assert.ok(catalog.nodes.length <= 512);
  assert.ok(Buffer.byteLength(JSON.stringify(catalog)) <= 256 * 1024);
  assert.ok(
    catalog.omissions.some((gap) =>
      gap.includes("Bounded relationship catalogue omitted"),
    ),
  );
  assert.doesNotMatch(JSON.stringify(catalog), /const item|service\(/);
});
