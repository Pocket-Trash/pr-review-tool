import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveAutomaticEvent, resolveReviewEvent } from "../src/events.mjs";

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

const manualEvent = (body = "!pockettrash review") => ({
  action: "created",
  repository: { full_name: "Pocket-Trash/example" },
  issue: { number: 42, pull_request: { url: "https://api.github.test/pr/42" } },
  comment: { body, user: { login: "maintainer" } },
});

const manualFetch =
  ({ permission = "write", state = "open", draft = false } = {}) =>
  async (url) => {
    if (url.endsWith("/pulls/42"))
      return new Response(
        JSON.stringify({
          state,
          draft,
          base: { sha: "current-base" },
          head: { sha: "current-head", repo: { fork: false } },
        }),
      );
    if (url.endsWith("/collaborators/maintainer/permission"))
      return new Response(
        JSON.stringify({ permission, role_name: permission }),
      );
    throw new Error(`unexpected request: ${url}`);
  };

test("runs an exact whitespace-normalized command from an authorized collaborator", async () => {
  for (const permission of ["write", "maintain", "admin"])
    assert.deepEqual(
      await resolveReviewEvent(
        manualEvent(" \n !pockettrash\t review  "),
        "token",
        manualFetch({ permission }),
      ),
      {
        shouldRun: true,
        repository: "Pocket-Trash/example",
        pullNumber: 42,
        baseSha: "current-base",
        headSha: "current-head",
        fork: false,
      },
    );
});

test("uses effective permission rather than a privileged-looking custom role", async () => {
  for (const [permission, expected] of [
    ["write", true],
    ["read", false],
  ]) {
    const fetch = async (url) => {
      if (url.endsWith("/pulls/42")) return manualFetch()(url);
      return new Response(JSON.stringify({ permission, role_name: "admin" }));
    };
    assert.equal(
      (await resolveReviewEvent(manualEvent(), "token", fetch)).shouldRun,
      expected,
    );
  }
});

test("skips near matches and ordinary issue comments without API calls", async () => {
  for (const candidate of [
    manualEvent("!pockettrash reviews"),
    { ...manualEvent(), issue: { number: 42 } },
    { ...manualEvent(), action: "edited" },
  ]) {
    let called = false;
    const result = await resolveReviewEvent(candidate, "token", async () => {
      called = true;
    });
    assert.equal(result.shouldRun, false);
    assert.equal(called, false);
  }
});

test("skips unauthorized, draft, and closed manual requests", async () => {
  assert.equal(
    (
      await resolveReviewEvent(
        manualEvent(),
        "token",
        manualFetch({ permission: "read" }),
      )
    ).shouldRun,
    false,
  );
  assert.equal(
    (
      await resolveReviewEvent(
        manualEvent(),
        "token",
        manualFetch({ draft: true }),
      )
    ).shouldRun,
    false,
  );
  assert.equal(
    (
      await resolveReviewEvent(
        manualEvent(),
        "token",
        manualFetch({ state: "closed" }),
      )
    ).shouldRun,
    false,
  );
});

test("visual commands are authorized independently and review comments cannot enter visual concurrency", async () => {
  for (const body of [
    "!pockettrash review",
    "!pockettrash visuals now",
    "!pockettrash visual",
    "quoted !pockettrash visuals",
  ]) {
    const result = await resolveReviewEvent(
      manualEvent(body),
      "token",
      async () => assert.fail("unrelated command called API"),
      "visuals",
    );
    assert.equal(result.shouldRun, false);
  }
  for (const permission of ["write", "maintain", "admin"]) {
    const result = await resolveReviewEvent(
      manualEvent(" \n!pockettrash\tvisuals "),
      "token",
      manualFetch({ permission }),
      "visuals",
    );
    assert.equal(result.shouldRun, true);
    assert.equal(result.headSha, "current-head");
  }
  for (const options of [
    { permission: "read" },
    { draft: true },
    { state: "closed" },
  ]) {
    assert.equal(
      (
        await resolveReviewEvent(
          manualEvent("!pockettrash visuals"),
          "token",
          manualFetch(options),
          "visuals",
        )
      ).shouldRun,
      false,
    );
  }
  for (const action of ["opened", "ready_for_review"])
    assert.equal(
      (
        await resolveReviewEvent(
          event(action),
          "token",
          async () => new Response("[]"),
          "visuals",
        )
      ).shouldRun,
      true,
    );
  assert.equal(
    (
      await resolveReviewEvent(
        event("synchronize"),
        "token",
        async () => assert.fail("push called API"),
        "visuals",
      )
    ).shouldRun,
    false,
  );
});
