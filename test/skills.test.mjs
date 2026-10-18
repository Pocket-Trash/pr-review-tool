import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  discoverInstalledSkills,
  filterSkillOverrides,
  loadSkillInstallFailures,
  packageManifestPaths,
  selectRelevantSkills,
  summarizePackageEvidence,
  validateSkillManifest,
} from "../src/skills.mjs";

const manifest = JSON.parse(
  await readFile(new URL("../skills/manifest.json", import.meta.url), "utf8"),
);

test("manifest pins the CLI, six sources, and nineteen external skills", () => {
  validateSkillManifest(manifest);
  assert.equal(manifest.cli, "skills@1.7.2");
  assert.equal(manifest.sources.length, 6);
  assert.equal(manifest.sources.flatMap(({ skills }) => skills).length, 19);
  assert.deepEqual(
    manifest.sources.map(({ repository, commit }) => [repository, commit]),
    [
      [
        "tanstack-skills/tanstack-skills",
        "6f5521ecbdfbfa3d54d335eba6c8b4df0b804c03",
      ],
      ["clerk/skills", "8482d43fe12a5f06a2b5ab3008615875747a3e4e"],
      ["github/awesome-copilot", "cb64ad12e32737ae764becd6885462e9b4c7cb00"],
      ["DietrichGebert/ponytail", "1099dd9128da88e8470338679b6f2d266382482b"],
      ["ayghri/i-have-adhd", "1ecea1993b7fce257ffbd686c070948b5e07eda6"],
      ["hardikpandya/stop-slop", "8da1f030185bdfe8471220585162991eaeb970e9"],
    ],
  );
  assert.deepEqual(
    manifest.sources.flatMap(({ skills }) => skills.map(({ name }) => name)),
    [
      "tanstack-ai",
      "tanstack-cli",
      "tanstack-config",
      "tanstack-db",
      "tanstack-devtools",
      "tanstack-form",
      "tanstack-pacer",
      "tanstack-query",
      "tanstack-ranger",
      "tanstack-router",
      "tanstack-start",
      "tanstack-store",
      "tanstack-table",
      "tanstack-virtual",
      "clerk-tanstack-patterns",
      "postgresql-code-review",
      "ponytail-review",
      "i-have-adhd",
      "stop-slop",
    ],
  );
});

test("manifest rejects source and installed-skill cap overflow", () => {
  assert.throws(
    () =>
      validateSkillManifest({
        ...manifest,
        sources: Array(9).fill(manifest.sources[0]),
      }),
    /at most 8 sources/,
  );
  const oversized = structuredClone(manifest);
  oversized.sources[0].skills.push(
    ...Array.from({ length: 6 }, (_, index) => ({ name: `extra-${index}` })),
  );
  assert.throws(() => validateSkillManifest(oversized), /at most 24 skills/);
});

test("selection uses changed dependencies and does not inject every TanStack skill", async () => {
  const root = await mkdtemp(join(tmpdir(), "pr-review-skill-test-"));
  try {
    for (const name of [
      "review-coordinator",
      "i-have-adhd",
      "stop-slop",
      "tanstack-query",
      "tanstack-router",
      "ponytail-review",
    ]) {
      await mkdir(join(root, name), { recursive: true });
      await writeFile(
        join(root, name, "SKILL.md"),
        `---\nname: ${name}\ndescription: Test skill\n---\n`,
      );
    }
    const installed = await discoverInstalledSkills(root);
    const result = selectRelevantSkills({
      manifest,
      installed,
      files: [
        {
          filename: "apps/web/package.json",
          content: JSON.stringify({
            dependencies: { "@tanstack/react-query": "5.0.0" },
          }),
        },
      ],
    });
    assert.deepEqual(result.selected, [
      "review-coordinator",
      "tanstack-query",
      "ponytail-review",
      "i-have-adhd",
      "stop-slop",
    ]);
    assert.ok(!result.selected.includes("tanstack-router"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trusted configuration overrides manual-only metadata and missing specialists warn", async () => {
  const root = await mkdtemp(join(tmpdir(), "pr-review-skill-override-test-"));
  try {
    await mkdir(join(root, "tanstack-router"));
    await writeFile(
      join(root, "tanstack-router", "SKILL.md"),
      "---\nname: tanstack-router\ndescription: Test skill\ndisable-model-invocation: true\n---\n",
    );
    const result = selectRelevantSkills({
      manifest,
      installed: await discoverInstalledSkills(root),
      configured: ["tanstack-router", "postgresql-code-review"],
      files: [],
    });
    assert.ok(result.selected.includes("tanstack-router"));
    assert.match(result.overrides[0], /metadata overridden/);
    assert.ok(
      result.coverageGaps.some((warning) =>
        warning.includes("postgresql-code-review"),
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("package ownership selects a specialist without a dependency change", async () => {
  const root = await mkdtemp(join(tmpdir(), "pr-review-skill-owner-test-"));
  try {
    await mkdir(join(root, "postgresql-code-review"));
    await writeFile(
      join(root, "postgresql-code-review", "SKILL.md"),
      "---\nname: postgresql-code-review\ndescription: Test skill\n---\n",
    );
    const result = selectRelevantSkills({
      manifest,
      installed: await discoverInstalledSkills(root),
      files: [{ filename: "packages/database/src/client.ts", content: "" }],
    });
    assert.ok(result.selected.includes("postgresql-code-review"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("package manifests include the root and changed workspace owner", () => {
  assert.deepEqual(
    packageManifestPaths([{ filename: "apps/web/src/page.tsx" }]),
    ["package.json", "apps/web/package.json"],
  );
});

test("unchanged dependency versions are summarized for reviewer evidence", () => {
  assert.deepEqual(
    summarizePackageEvidence([
      {
        filename: "apps/web/package.json",
        content: JSON.stringify({
          dependencies: { "@tanstack/react-query": "5.66.0" },
        }),
      },
    ]),
    [
      {
        filename: "apps/web/package.json",
        dependencies: [
          {
            group: "dependencies",
            name: "@tanstack/react-query",
            version: "5.66.0",
          },
        ],
      },
    ],
  );
});

test("package evidence enforces byte and field-length limits", () => {
  const result = summarizePackageEvidence(
    [
      {
        filename: "package.json",
        content: JSON.stringify({
          dependencies: { ["x".repeat(1_000)]: "y".repeat(1_000) },
        }),
      },
    ],
    { maxBytes: 700 },
  );
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 700);
  assert.equal(result[0].dependencies[0].name.length, 256);
  assert.equal(result[0].dependencies[0].version.length, 256);
});

test("installer failures are machine-readable and remain coverage gaps", async () => {
  const root = await mkdtemp(join(tmpdir(), "pr-review-skill-failure-test-"));
  try {
    const path = join(root, "status.json");
    await writeFile(
      path,
      JSON.stringify({ failures: [{ skill: "tanstack-query" }] }),
    );
    assert.deepEqual(await loadSkillInstallFailures(path), ["tanstack-query"]);
    assert.deepEqual(
      await loadSkillInstallFailures(join(root, "missing.json")),
      [],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("malformed installed skill is unavailable instead of aborting selection", async () => {
  const root = await mkdtemp(join(tmpdir(), "pr-review-skill-malformed-test-"));
  try {
    await mkdir(join(root, "tanstack-query"));
    await writeFile(
      join(root, "tanstack-query", "SKILL.md"),
      "---\nname: tanstack-query\n---\n",
    );
    const result = selectRelevantSkills({
      manifest,
      installed: await discoverInstalledSkills(root),
      configured: ["tanstack-query"],
      files: [],
    });
    assert.ok(
      result.coverageGaps.some((gap) => gap.includes("tanstack-query")),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime fallback removes overrides for omitted specialists", () => {
  assert.deepEqual(
    filterSkillOverrides(
      [
        "tanstack-router: model-invocation metadata overridden by trusted selection",
      ],
      ["review-coordinator", "i-have-adhd", "stop-slop"],
    ),
    [],
  );
});
