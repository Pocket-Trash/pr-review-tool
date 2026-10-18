import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveAutomaticEvent } from "../src/events.mjs";

const fixture = JSON.parse(
  await readFile(
    new URL("fixtures/events/pull-request-opened.json", import.meta.url),
    "utf8",
  ),
);
const event = (action, draft = false) => ({
  ...structuredClone(fixture),
  action,
  pull_request: { ...structuredClone(fixture.pull_request), draft },
});

for (const action of ["opened", "synchronize", "ready_for_review"]) {
  test(`runs a non-draft ${action} event`, () => {
    assert.deepEqual(resolveAutomaticEvent(event(action)), {
      shouldRun: true,
      repository: "Pocket-Trash/example",
      pullNumber: 42,
      baseSha: "base-sha",
      headSha: "head-sha",
      fork: false,
    });
  });
}

test("skips draft and unrelated events before inference", () => {
  assert.deepEqual(resolveAutomaticEvent(event("synchronize", true)), {
    shouldRun: false,
    reason: "draft pull request",
  });
  assert.deepEqual(resolveAutomaticEvent(event("reopened")), {
    shouldRun: false,
    reason: "unsupported action: reopened",
  });
});

test("accepts an external fork as untrusted data", () => {
  const fork = event("opened");
  fork.pull_request.head.repo.fork = true;
  assert.equal(resolveAutomaticEvent(fork).fork, true);
});

test("rejects incomplete runnable events", () => {
  assert.throws(
    () => resolveAutomaticEvent({ action: "opened", pull_request: {} }),
    /repository\.full_name/,
  );
});
