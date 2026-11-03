import test from "node:test";
import assert from "node:assert/strict";
import {
  visualRequirements,
  preparedVisualRequirements,
} from "../src/visuals.mjs";
import {
  buildRelationshipCatalog,
  renderEvidenceVisuals,
} from "../src/relationships.mjs";
const identity = { baseSha: "a".repeat(40), headSha: "b".repeat(40) };
const file = (filename, content, baseContent = "") => ({
  filename,
  content,
  baseContent,
  baseSha: identity.baseSha,
  status: baseContent ? "modified" : "added",
  additions: 10,
  deletions: 0,
  patch: "+ changed",
});
const route = () => [
  file(
    "app/routes/search.tsx",
    `import { createFileRoute } from '@tanstack/react-router'; import { search } from '../search'; export const Route = createFileRoute('/search')({ loader: () => search() });`,
  ),
  file("app/search.ts", "export function search() { return []; }"),
];
test("route-owned fetching admits a source-backed architecture slice", () => {
  const files = route();
  assert.equal(visualRequirements(files).architecture, true);
  const catalog = buildRelationshipCatalog({ identity, files });
  const edges = catalog.relationships.filter(
    (e) => e.kind === "source-binding",
  );
  assert.ok(edges.length);
  const selected = edges.slice(0, 2);
  const rendered = renderEvidenceVisuals(
    {
      diagrams: [
        {
          kind: "architecture",
          title: "Route data ownership",
          nodeIds: [...new Set(selected.flatMap((e) => [e.from, e.to]))],
          relationshipIds: selected.map((e) => e.id),
        },
      ],
    },
    catalog,
  );
  assert.match(rendered.diagrams[0].mermaid, /search/);
});

test("shared context provisioning and consumers qualify without treating local reducers as architecture", () => {
  const files = [
    file(
      "app/settings.ts",
      `import {createContext,useContext} from 'react'; export const Settings = createContext(null); export function useSettings(){return useContext(Settings)}`,
    ),
    file(
      "app/provider.tsx",
      `import {Settings} from './settings'; export function Provider(){const store={};return <Settings.Provider value={store}/>}`,
    ),
    file(
      "app/theme.ts",
      `import {useSettings} from './settings'; export function useTheme(){return useSettings()}`,
    ),
    file(
      "app/locale.ts",
      `import {useSettings} from './settings'; export function useLocale(){return useSettings()}`,
    ),
  ];
  assert.equal(visualRequirements(files).architecture, true);
  assert.ok(
    buildRelationshipCatalog({ identity, files }).relationships.some(
      (e) => e.kind === "source-binding",
    ),
  );
  assert.equal(
    visualRequirements([
      file(
        "app/editor.ts",
        "export function editor(){return useReducer(reducer, {})}",
      ),
    ]).architecture,
    false,
  );
});
test("unchanged loaders, dependency cleanup and tiny queue fixes do not admit architecture", () => {
  const files = route().map((f) => ({
    ...f,
    baseContent: f.content,
    status: "modified",
  }));
  assert.equal(visualRequirements(files).architecture, false);
  assert.equal(
    visualRequirements([file("package.json", "{}")]).architecture,
    false,
  );
  assert.equal(
    visualRequirements([
      file(
        "packages/queue/src/index.ts",
        "export function retry(){wake()}",
        "export function retry(){if(now()>at)wake()}",
      ),
    ]).architecture,
    false,
  );
});
test("unknown application source cannot claim a clean no-work skip", () => {
  assert.throws(
    () =>
      preparedVisualRequirements({
        conclusion: "review",
        files: [file("app/route.ts", "not valid @@")],
      }),
    /incomplete/,
  );
  const files = route().map((f) => ({ ...f, baseContent: undefined }));
  assert.throws(
    () => preparedVisualRequirements({ conclusion: "review", files }),
    /incomplete/,
  );
});

test("shadowed factories and removed modules cannot prove head connections", () => {
  const files = route();
  files[0].content = `import {createFileRoute} from '@tanstack/react-router'; import {search} from '../search'; function fake(createFileRoute){const Route=createFileRoute('/x')({loader:()=>search()})}`;
  assert.equal(visualRequirements(files).architecture, false);
  const deleted = route();
  deleted[1].status = "removed";
  assert.equal(visualRequirements(deleted).architecture, false);
});
test("context read budgets bound missing-path probes and cannot become a no-work skip", async () => {
  const { prepareApplicationContext } = await import(
    "../src/application-architecture.mjs"
  );
  const prepared = {
    conclusion: "review",
    files: [
      file(
        "app/editor.ts",
        Array.from(
          { length: 100 },
          (_, i) => `import x${i} from './missing${i}';`,
        ).join("\n"),
      ),
    ],
    omissions: [],
  };
  let reads = 0;
  await prepareApplicationContext(
    prepared,
    identity,
    async () => {
      reads++;
      return null;
    },
    { maxFiles: 100, maxFileBytes: 10000, maxBytes: 100000 },
  );
  assert.ok(reads <= 128);
  assert.equal(prepared.applicationIncomplete, true);
  assert.throws(() => preparedVisualRequirements(prepared), /incomplete/);
});

test("admitted architecture survives provider selection, validation and host rendering", async () => {
  const { mkdtemp, writeFile, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { runRestrictedReview } = await import("../src/opencode.mjs");
  const { renderReview } = await import("../src/review.mjs");
  const workspace = await mkdtemp(join(tmpdir(), "application-visual-test-"));
  try {
    const files = route();
    await writeFile(
      join(workspace, "pull-request.json"),
      JSON.stringify({ identity, files, omissions: [] }),
    );
    let calls = 0;
    const result = await runRestrictedReview({
      task: "visuals",
      provider: "openrouter",
      model: "fixture",
      apiKey: "fixture",
      workspace,
      visualRequirements: visualRequirements(files),
      execute: async (_command, _args, options) => {
        calls++;
        const catalog = JSON.parse(
          await readFile(
            join(options.cwd, "review-relationships.json"),
            "utf8",
          ),
        );
        const edge = catalog.relationships.find(
          (e) => e.kind === "source-binding",
        );
        return {
          stdout: JSON.stringify({
            type: "text",
            part: {
              text: JSON.stringify({
                factIds: [],
                diagrams: [
                  { kind: "architecture", relationshipIds: [edge.id] },
                ],
              }),
            },
          }),
        };
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.diagrams.length, 1);
    const config = JSON.parse(
      await readFile(
        new URL("./fixtures/config.visuals-approved.json", import.meta.url),
      ),
    );
    const run = JSON.parse(
      await readFile(new URL("./fixtures/run.valid.json", import.meta.url)),
    );
    assert.match(renderReview(config, result, run), /loader calls/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("an inaccessible nested local cannot hijack an imported service", () => {
  const files = route();
  files[0].content = files[0].content.replace(
    "export const Route",
    "function unrelated(){const search=()=>0} export const Route",
  );
  assert.equal(visualRequirements(files).architecture, false);
});
test("root static path aliases are read without inventing baseline evidence", async () => {
  const { prepareApplicationContext } = await import(
    "../src/application-architecture.mjs"
  );
  const prepared = {
    files: [file("src/route.ts", `import {search} from '@/search';`)],
    omissions: [],
  };
  await prepareApplicationContext(
    prepared,
    identity,
    async (path) =>
      path === "tsconfig.json"
        ? {
            content: JSON.stringify({
              compilerOptions: { paths: { "@/*": ["./src/*"] } },
            }),
          }
        : path === "src/search.ts"
          ? { filename: path, content: "export const search=()=>[]" }
          : null,
    { maxFiles: 100, maxFileBytes: 10000, maxBytes: 100000 },
  );
  assert.equal(prepared.files[0].applicationAliases["@/"], "src/");
  assert.equal(prepared.files[1].baseContent, undefined);
});

test("base-only declarations are visibly removed in rendered architecture", () => {
  const files = [
    file(
      "app/old.ts",
      "export function old(){work()}",
      "export function old(){work()}",
    ),
  ];
  files[0].status = "removed";
  const catalog = buildRelationshipCatalog({ identity, files });
  const edge = catalog.relationships.find((e) => e.kind === "source-call");
  const result = renderEvidenceVisuals(
    {
      diagrams: [
        {
          kind: "architecture",
          title: "Declarations",
          nodeIds: [edge.from, edge.to],
          relationshipIds: [edge.id],
        },
      ],
    },
    catalog,
  );
  assert.match(result.diagrams[0].mermaid, /removed; base source/);
});
