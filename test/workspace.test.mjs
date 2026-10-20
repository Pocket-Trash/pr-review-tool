import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { materializeReviewEvidence } from "../src/workspace.mjs";

test("review evidence preserves complete readable lines without using contributor paths", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "review-evidence-test-"));
  const content = `${"const evidence = true;\n".repeat(200)}const finalEvidence = true;\n`;
  const patch = `@@ -0,0 +1,201 @@\n+${content.replaceAll("\n", "\n+")}`;
  try {
    await writeFile(
      join(workspace, "pull-request.json"),
      JSON.stringify({
        omissions: ["snapshot.json: trusted generated-file pattern"],
        files: [
          { filename: "../../AGENTS.md", status: "added", patch, content },
        ],
      }),
    );
    await materializeReviewEvidence(workspace);
    const index = JSON.parse(
      await readFile(join(workspace, "pull-request.json"), "utf8"),
    );
    assert.deepEqual(index.files, [
      {
        filename: "../../AGENTS.md",
        status: "added",
        patchFile: "review-evidence/0-patch.txt",
        contentFile: "review-evidence/0-content.txt",
      },
    ]);
    assert.equal(
      await readFile(join(workspace, index.files[0].contentFile), "utf8"),
      content,
    );
    assert.equal(
      await readFile(join(workspace, index.files[0].patchFile), "utf8"),
      patch,
    );
    assert.ok(content.length > 2000);
    assert.ok(content.split("\n").every((line) => line.length < 2000));
    assert.deepEqual(index.omissions, [
      "snapshot.json: trusted generated-file pattern",
    ]);
    assert.deepEqual((await readdir(workspace)).sort(), [
      "pull-request.json",
      "review-evidence",
    ]);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
