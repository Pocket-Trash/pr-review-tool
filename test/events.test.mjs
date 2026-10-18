import assert from "node:assert/strict";
import test from "node:test";
import { resolveAutomaticEvent } from "../src/events.mjs";

const event = (action, draft = false) => ({
  action,
  repository: { full_name: "Pocket-Trash/example" },
  pull_request: {
    number: 42,
    draft,
    base: { sha: "base-sha" },
    head: { sha: "head-sha", repo: { fork: false } },
  },
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

test("rejects incomplete runnable events", () => {
  assert.throws(
    () => resolveAutomaticEvent({ action: "opened", pull_request: {} }),
    /repository\.full_name/,
  );
});
