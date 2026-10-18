import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { renderReview } from "../src/review.mjs";

const fixture = (name) => new URL(`fixtures/${name}`, import.meta.url);
const json = async (name) => JSON.parse(await readFile(fixture(name), "utf8"));

test("fixture CLI renders the review contract without external services", async () => {
  const result = spawnSync(
    process.execPath,
    [
      "src/fixture.mjs",
      "test/fixtures/config.valid.json",
      "test/fixtures/review.valid.json",
      "test/fixtures/run.valid.json",
    ],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout,
    await readFile(fixture("review.expected.md"), "utf8"),
  );
});

test("fixture CLI rejects invalid trusted configuration before other inputs", () => {
  const result = spawnSync(
    process.execPath,
    [
      "src/fixture.mjs",
      "package.json",
      "missing-review.json",
      "missing-run.json",
    ],
    { encoding: "utf8" },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /config must be free of unknown fields/);
  assert.doesNotMatch(result.stderr, /ENOENT/);
});

test("renderer rejects malformed model results", async () => {
  const config = await json("config.valid.json");
  const review = await json("review.valid.json");
  const run = await json("run.valid.json");

  assert.throws(
    () =>
      renderReview(
        config,
        { ...review, findings: [{ severity: "urgent" }] },
        run,
      ),
    /review\.findings\[0\] must be free of unknown fields|review\.findings\[0\]\.severity/,
  );
});

test("renderer records trusted manual skill overrides", async () => {
  const output = renderReview(
    await json("config.valid.json"),
    await json("review.valid.json"),
    {
      ...(await json("run.valid.json")),
      skillOverrides: ["tanstack-router: trusted selection"],
    },
  );
  assert.match(output, /Skill overrides: tanstack-router: trusted selection/);
});
