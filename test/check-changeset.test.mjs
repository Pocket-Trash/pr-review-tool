import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

for (const [name, text, status] of [
  [
    "patch",
    '---\n"@pocket-trash/pr-review-tool": patch\n---\nReview fix.\n',
    0,
  ],
  [
    "major",
    '---\n"@pocket-trash/pr-review-tool": major\n---\nReviewed breaking change.\n',
    0,
  ],
  ["unknown package", '---\n"wrong-package": patch\n---\nFix.\n', 1],
  ["empty marker", "---\n---\nFix.\n", 1],
  ["API failure", "api-failure", 1],
]) {
  test(`Changeset command handles ${name}`, (t) => {
    const directory = mkdtempSync(join(tmpdir(), "reviewer-changeset-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const event = join(directory, "event.json");
    writeFileSync(event, JSON.stringify({ pull_request: { number: 1 } }));
    const bootstrap = `globalThis.fetch = async (url, options) => {
      if (options.method && options.method !== 'GET') throw new Error('Writes are forbidden');
      if (process.env.MARKER === 'api-failure') return new Response(null, {status:403});
      if (url.includes('/contents/')) return Response.json({encoding:'base64',content:Buffer.from(process.env.MARKER).toString('base64')});
      if (url.includes('/files?')) return Response.json([{filename:'.changeset/fixture.md',status:'added'}]);
      return Response.json({head:{sha:'a'.repeat(40)}});
    };`;
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(bootstrap)}`,
        "scripts/check-changeset.mjs",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_EVENT_PATH: event,
          GITHUB_REPOSITORY: "Pocket-Trash/pr-review-tool",
          GITHUB_TOKEN: "fixture-secret",
          MARKER: text,
        },
      },
    );
    assert.equal(result.status, status, result.stderr);
    assert.ok(!result.stderr.includes("fixture-secret"));
  });
}
