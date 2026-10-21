import assert from "node:assert/strict";
import test from "node:test";
import {
  mkdtemp,
  mkdir,
  realpath,
  symlink,
  readFile,
  writeFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRestrictedReview } from "../src/opencode.mjs";
import { evidenceFromEvents, evidenceCoverage } from "../src/evidence.mjs";
import { prepareReviewContext } from "../src/context.mjs";
import { preparedVisualRequirements } from "../src/visuals.mjs";

const inventory = {
  version: "frozen-evidence-v1",
  omissions: ["lockfile omitted"],
  files: [
    {
      filename: ".github/workflows/deploy.yml",
      kind: "content",
      evidencePath: "review-evidence/0-content.txt",
      sha: "a".repeat(40),
      lineCount: 4,
    },
  ],
};
const read = (callID, output, extra = {}) => ({
  type: "tool_use",
  part: {
    type: "tool",
    tool: "read",
    callID,
    state: {
      status: "completed",
      input: { filePath: "/workspace/review-evidence/0-content.txt" },
      output,
      ...extra,
    },
  },
});

test("coverage records supplied source separately from partial/truncated reads", () => {
  const event = read("one", "00001| name: deploy\n00002| on: push", {
    metadata: { truncated: true },
  });
  const report = evidenceFromEvents(
    inventory,
    [event, event, read("two", "3: jobs:\n4:   test:")],
    "/workspace",
  );
  assert.deepEqual(report.files[0].returnedRanges, [[1, 4]]);
  assert.equal(report.files[0].readState, "full-returned");
  assert.equal(report.files[0].truncated, true);
  assert.match(
    evidenceCoverage(report)[0],
    /supplied in full.*read-tool output was truncated, not the supplied source/,
  );
  assert.doesNotMatch(JSON.stringify(report), /name: deploy|on: push|jobs:/);
});

test("unread, partial, failed and unknown reads are not unavailable source", () => {
  for (const [events, state] of [
    [[], "no-confirmed-read"],
    [[read("partial", "00002| on: push")], "partial-returned"],
    [[read("bad", undefined)], "unknown"],
    [[read("error", undefined, { status: "error" })], "failed"],
    [[read("out-of-bounds", "999: not a real source line")], "unknown"],
  ]) {
    const report = evidenceFromEvents(inventory, events, "/workspace");
    assert.equal(report.files[0].readState, state);
    assert.match(evidenceCoverage(report)[0], /was supplied in full/);
  }
  const search = read("search", "1: data");
  search.part.tool = "grep";
  assert.equal(
    evidenceFromEvents(inventory, [search], "/workspace").files[0].readState,
    "no-confirmed-read",
  );
  const outside = read("outside", "1: data");
  outside.part.state.input.filePath =
    "/elsewhere/review-evidence/0-content.txt";
  assert.equal(
    evidenceFromEvents(inventory, [outside], "/workspace").files[0].readState,
    "no-confirmed-read",
  );
});

test("eligible unavailable schema cannot become neutral no-work, but trusted exclusions can", async () => {
  const config = {
    generatedFiles: ["**/drizzle/meta/**"],
    limits: {
      maxFiles: 100,
      maxBytes: 1048576,
      maxChangedLines: 20000,
      maxFileBytes: 524288,
    },
  };
  const files = [
    {
      filename: "packages/db/schema/pens.ts",
      additions: 10,
      deletions: 0,
      patch: "@@ change",
    },
  ];
  const prepared = await prepareReviewContext(files, config, async () => ({
    available: false,
  }));
  assert.equal(prepared.files.length, 0);
  assert.throws(
    () => preparedVisualRequirements(prepared),
    /incomplete, not a no-work skip/,
  );
  const partial = {
    ...prepared,
    files: [
      {
        filename: "README.md",
        additions: 1,
        deletions: 0,
        patch: "@@ docs",
        content: "docs",
      },
    ],
  };
  assert.equal(preparedVisualRequirements(partial).schema, "small");
  const excluded = await prepareReviewContext(
    [{ ...files[0], filename: "packages/db/drizzle/meta/snapshot.json" }],
    config,
    async () => assert.fail(),
  );
  assert.equal(preparedVisualRequirements(excluded).schema, "none");
  const unknown = {
    files: [],
    eligibilityFiles: [
      { filename: "src/state.ts", additions: 1, deletions: 0 },
    ],
  };
  assert.throws(
    () => preparedVisualRequirements(unknown, 2),
    /unknown visual scope/,
  );
});

test("visual invocation publishes runner coverage without model-authored availability claims", async () => {
  const directory = await mkdtemp(join(tmpdir(), "coverage-run-"));
  let report;
  try {
    await writeFile(
      join(directory, "pull-request.json"),
      JSON.stringify({
        identity: { headSha: "a".repeat(40), baseSha: "b".repeat(40) },
        omissions: [],
        files: [
          {
            filename: "railway.ts",
            status: "modified",
            content: 'const queue = service("queue");\nconst active = queue;\n',
            patch: "@@ patch",
          },
        ],
      }),
    );
    const result = await runRestrictedReview({
      task: "visuals",
      provider: "openrouter",
      model: "fixture",
      apiKey: "fixture",
      workspace: directory,
      visualRequirements: { architecture: true, schema: "none" },
      onEvidence: (value) => {
        report = value;
      },
      execute: async (_command, _args, options) => {
        const catalog = JSON.parse(
          await readFile(
            join(options.cwd, "review-relationships.json"),
            "utf8",
          ),
        );
        const edge = catalog.relationships[0];
        return {
          stdout: [
            read("partial", "1: one", {
              input: {
                filePath: join(options.cwd, "review-evidence/0-content.txt"),
              },
              metadata: { truncated: true },
            }),
            {
              type: "text",
              part: {
                text: JSON.stringify({
                  factIds: [],
                  diagrams: [
                    {
                      kind: "architecture",
                      title: "Declared source calls",
                      nodeIds: [edge.from, edge.to],
                      relationshipIds: [edge.id],
                    },
                  ],
                }),
              },
            },
          ]
            .map((event) => JSON.stringify(event))
            .join("\n"),
        };
      },
    });
    assert.equal(report.version, "frozen-evidence-v1");
    assert.equal(
      report.files.find((file) => file.kind === "content").readState,
      "partial-returned",
    );
    assert.ok(
      result.coverageGaps.some((gap) =>
        /Runner evidence:.*supplied in full.*1-1/.test(gap),
      ),
    );
    assert.ok(
      !result.coverageGaps.some((gap) => gap.startsWith("Model-reported")),
    );
    assert.equal(
      Object.keys(result).sort().join(),
      "changedAreas,coverageGaps,diagrams,overview",
    );
    assert.doesNotMatch(
      JSON.stringify(report),
      /one\\ntwo|state|output|filePath/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("canonical workspace paths confirm reads through a temporary-directory alias", async () => {
  const directory = await mkdtemp(join(tmpdir(), "coverage-alias-"));
  const originalTemp = process.env.TMPDIR;
  let report;
  try {
    await mkdir(join(directory, "real"));
    await mkdir(join(directory, "prepared"));
    await symlink(join(directory, "real"), join(directory, "alias"), "dir");
    await writeFile(
      join(directory, "prepared/pull-request.json"),
      JSON.stringify({
        identity: { headSha: "a".repeat(40), baseSha: "b".repeat(40) },
        files: [
          {
            filename: "railway.ts",
            content: 'const queue=service("queue");\nconst active=queue;\n',
          },
        ],
      }),
    );
    process.env.TMPDIR = join(directory, "alias");
    await runRestrictedReview({
      task: "visuals",
      provider: "openrouter",
      model: "fixture",
      apiKey: "fixture",
      workspace: join(directory, "prepared"),
      visualRequirements: { architecture: true, schema: "none" },
      onEvidence: (value) => {
        report = value;
      },
      execute: async (_command, _args, options) => {
        assert.equal(options.cwd, await realpath(options.cwd));
        const catalog = JSON.parse(
          await readFile(
            join(options.cwd, "review-relationships.json"),
            "utf8",
          ),
        );
        const edge = catalog.relationships[0];
        return {
          stdout: [
            read("confirmed", "1: const queue = service();", {
              input: {
                filePath: await realpath(
                  join(options.cwd, "review-evidence/0-content.txt"),
                ),
              },
            }),
            {
              type: "text",
              part: {
                text: JSON.stringify({
                  factIds: [],
                  diagrams: [
                    {
                      kind: "architecture",
                      title: "Declared",
                      nodeIds: [edge.from, edge.to],
                      relationshipIds: [edge.id],
                    },
                  ],
                }),
              },
            },
          ]
            .map((event) => JSON.stringify(event))
            .join("\n"),
        };
      },
    });
    const file = report.files.find((file) => file.kind === "content");
    assert.deepEqual(file.returnedRanges, [[1, 1]]);
    assert.equal(file.readState, "partial-returned");
  } finally {
    if (originalTemp === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = originalTemp;
    await rm(directory, { recursive: true, force: true });
  }
});
