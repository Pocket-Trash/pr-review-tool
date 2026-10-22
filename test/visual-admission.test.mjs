import assert from "node:assert/strict";
import test from "node:test";
import { resolveReviewEvent } from "../src/events.mjs";
import { admitVisualRun } from "../src/visual-admission.mjs";
import {
  VISUAL_COMMENT_MARKER,
  VISUAL_RERUN_FOOTER,
  withVisualRerun,
  isVisualRerunToggle,
} from "../src/comment-controls.mjs";

const repository = "Pocket-Trash/example";
const appSlug = "pocket-trash-pr-review";
const user = { type: "User", login: "maintainer", id: 7 };
const bot = { type: "Bot", login: `${appSlug}[bot]` };
const headSha = "a".repeat(40);
const pull = {
  number: 42,
  state: "open",
  draft: false,
  base: { sha: "b".repeat(40) },
  head: { sha: headSha, repo: { fork: true } },
};
const auto = (action = "opened") => ({
  action,
  repository: { full_name: repository },
  pull_request: structuredClone(pull),
});
const owned = (
  body = withVisualRerun(
    `${VISUAL_COMMENT_MARKER}\n<!-- pockettrash:pr-visuals-run 90:1 -->\nPrior results`,
    "visuals",
  ),
) => ({
  id: 12,
  user: bot,
  body,
  issue_url: `https://api.github.com/repos/${repository}/issues/42`,
});
const toggle = (comment = owned()) => ({
  action: "edited",
  repository: { full_name: repository },
  issue: { number: 42, pull_request: {} },
  sender: user,
  changes: { body: { from: comment.body } },
  comment: {
    ...comment,
    updated_at: "2026-10-22T04:00:00Z",
    body:
      comment.body.slice(0, -VISUAL_RERUN_FOOTER.length) +
      VISUAL_RERUN_FOOTER.replace("[ ]", "[x]"),
  },
});
function harness({
  comments = [],
  permission = "write",
  currentPull = pull,
  failWrite = false,
} = {}) {
  const state = { comments: structuredClone(comments), writes: [], calls: [] };
  const fetch = async (url, options = {}) => {
    state.calls.push(url);
    if (options.method) {
      if (failWrite) return new Response("{}", { status: 503 });
      const body = JSON.parse(options.body).body;
      const comment = owned(body);
      state.writes.push({ method: options.method, body });
      state.comments = [comment];
      return new Response(JSON.stringify(comment));
    }
    if (url.includes("/comments?"))
      return new Response(JSON.stringify(state.comments));
    if (url.endsWith("/issues/comments/12"))
      return new Response(
        JSON.stringify(state.comments.find((c) => c.id === 12)),
      );
    if (url.endsWith("/pulls/42"))
      return new Response(JSON.stringify(currentPull));
    if (url.endsWith("/collaborators/maintainer/permission"))
      return new Response(JSON.stringify({ permission, role_name: "admin" }));
    throw Error(`Unexpected request ${url}`);
  };
  const admit = (event, runId = "100", runAttempt = "1", extra = {}) =>
    admitVisualRun({
      event,
      runId,
      runAttempt,
      appSlug,
      authenticatedAppSlug: appSlug,
      token: "fixture-app-token",
      pullNumber: 42,
      fetch,
      ...extra,
    });
  const resolve = (event, runId, runAttempt = "1") =>
    resolveReviewEvent(event, "fixture-read-token", fetch, "visuals", {
      appSlug,
      runId,
      runAttempt,
    });
  return { ...state, state, fetch, admit, resolve };
}

test("first automatic visual attempt is claimed before inference and survives cancellation/failure", async () => {
  const h = harness();
  const event = auto();
  assert.equal((await h.resolve(event)).shouldRun, true);
  assert.equal((await h.admit(event)).shouldRun, true);
  assert.equal(h.state.writes.length, 1);
  assert.match(h.state.writes[0].body, /Results are pending/);
  assert.ok(h.state.writes[0].body.endsWith(VISUAL_RERUN_FOOTER));
  assert.equal((await h.resolve(event, "100")).shouldRun, true);
  assert.equal((await h.admit(event)).shouldRun, false);
  for (const next of [
    auto("opened"),
    auto("ready_for_review"),
    auto("synchronize"),
    auto("reopened"),
    { ...auto(), pull_request: { ...pull, draft: true } },
  ])
    assert.equal((await h.resolve(next, "101")).shouldRun, false);
  assert.equal((await h.resolve(event, "100", "2")).shouldRun, false);
  assert.equal(h.state.writes.length, 1);
});

test("a draft starts only on its first ready event and existing published comments suppress automatic work", async () => {
  const h = harness();
  assert.equal(
    (await h.resolve({ ...auto(), pull_request: { ...pull, draft: true } }))
      .shouldRun,
    false,
  );
  assert.equal((await h.admit(auto("ready_for_review"))).shouldRun, true);
  const prior = harness({ comments: [owned()] });
  assert.equal((await prior.resolve(auto())).shouldRun, false);
  assert.equal(prior.state.writes.length, 0);
});

test("authorized checkbox editor, not bot author, requests current SHA once and resets before inference", async () => {
  for (const permission of ["write", "maintain", "admin"]) {
    const event = toggle();
    const h = harness({ comments: [event.comment], permission });
    assert.equal((await h.resolve(event)).headSha, headSha);
    assert.equal((await h.admit(event)).shouldRun, true);
    assert.equal(h.state.writes[0].method, "PATCH");
    assert.ok(h.state.comments[0].body.endsWith(VISUAL_RERUN_FOOTER));
    assert.equal((await h.resolve(event, "100")).shouldRun, true);
    assert.equal((await h.resolve(event, "101")).shouldRun, false);
    assert.equal((await h.admit(event)).shouldRun, false);
    assert.equal(h.state.writes.length, 1);
    assert.ok(
      h.state.calls.some((u) =>
        u.includes("/collaborators/maintainer/permission"),
      ),
    );
    assert.ok(!h.state.calls.some((u) => u.includes("[bot]")));
    const again = toggle(h.state.comments[0]);
    h.state.comments = [again.comment];
    assert.equal((await h.admit(again, "101")).shouldRun, true);
    assert.equal(h.state.writes.length, 2);
  }
});

test("unrelated edits, bot edits, copied controls and checked-to-checked changes never reach authorization", async () => {
  const original = toggle();
  const cases = [
    { ...original, action: "created" },
    { ...original, sender: bot },
    { ...original, sender: undefined },
    { ...original, comment: { ...original.comment, user } },
    {
      ...original,
      comment: { ...original.comment, user: { ...bot, login: "other[bot]" } },
    },
    {
      ...original,
      comment: {
        ...original.comment,
        body: original.comment.body + " extra edit",
      },
    },
    {
      ...original,
      comment: { ...original.comment, body: original.changes.body.from },
    },
    { ...original, changes: { body: { from: original.comment.body } } },
    { ...original, changes: {} },
    {
      ...original,
      comment: {
        ...original.comment,
        body: original.comment.body.replace("pr-visuals -->", "pr-review -->"),
      },
    },
  ];
  for (const event of cases) {
    assert.equal(isVisualRerunToggle(event, appSlug), false);
    assert.equal(
      (
        await resolveReviewEvent(
          event,
          "token",
          async () => assert.fail("unrelated event called API"),
          "visuals",
        )
      ).shouldRun,
      false,
    );
  }
});

test("checkbox authorization fails closed for readers, closed/draft PRs and changed comment ownership or association", async () => {
  const event = toggle();
  for (const options of [
    { permission: "read" },
    { permission: "triage" },
    { currentPull: { ...pull, draft: true } },
    { currentPull: { ...pull, state: "closed" } },
    { comments: [{ ...event.comment, user }] },
    {
      comments: [
        {
          ...event.comment,
          issue_url: `https://api.github.com/repos/${repository}/issues/99`,
        },
      ],
    },
    { comments: [owned()] },
  ]) {
    const h = harness({ comments: [event.comment], ...options });
    assert.equal((await h.resolve(event)).shouldRun, false);
    assert.equal(h.state.writes.length, 0);
  }
  assert.equal(
    (
      await resolveReviewEvent(
        event,
        "token",
        async () => assert.fail("review lane used checkbox"),
        "review",
      )
    ).shouldRun,
    false,
  );
});

test("admission rejects stale heads, closed/draft PRs, wrong App and mismatched concurrency identity before writes", async () => {
  for (const currentPull of [
    { ...pull, head: { ...pull.head, sha: "c".repeat(40) } },
    { ...pull, draft: true },
    { ...pull, state: "closed" },
  ]) {
    const h = harness({ currentPull });
    assert.equal((await h.admit(auto())).shouldRun, false);
    assert.equal(h.state.writes.length, 0);
  }
  const h = harness();
  await assert.rejects(
    h.admit(auto(), "100", "1", { authenticatedAppSlug: "wrong" }),
    /expected GitHub App/,
  );
  await assert.rejects(
    h.admit(auto(), "100", "1", { pullNumber: 99 }),
    /serialized PR/,
  );
  assert.equal(h.state.writes.length, 0);
  await assert.rejects(
    harness({ failWrite: true }).admit(auto()),
    /admission failed: 503/,
  );
  const newer = harness({
    comments: [
      owned(
        withVisualRerun(
          `${VISUAL_COMMENT_MARKER}\n<!-- pockettrash:pr-visuals-run 999:1 -->\nNewer result`,
          "visuals",
        ),
      ),
    ],
  });
  const command = {
    action: "created",
    repository: { full_name: repository },
    issue: { number: 42, pull_request: {} },
    comment: { id: 99, user, body: "!pockettrash visuals" },
  };
  await assert.rejects(newer.admit(command), /newer visual run/);
  assert.equal(newer.state.writes.length, 0);
});

test("manual command is available after the automatic claim, without enabling review or bot reruns", async () => {
  const h = harness({ comments: [owned()] });
  const event = {
    action: "created",
    repository: { full_name: repository },
    issue: { number: 42, pull_request: {} },
    comment: { id: 99, user, body: "!pockettrash visuals" },
  };
  assert.equal((await h.admit(event)).shouldRun, true);
  assert.equal(
    (
      await h.admit(
        { ...event, comment: { ...event.comment, user: bot } },
        "101",
      )
    ).shouldRun,
    false,
  );
  assert.equal(h.state.writes.length, 1);
});

test("automatic history lookup paginates and ignores spoofed markers", async () => {
  let count = 0;
  const spoofed = Array.from({ length: 100 }, (_, id) => ({
    ...owned(),
    id,
    user,
  }));
  const result = await resolveReviewEvent(
    auto(),
    "token",
    async () =>
      new Response(JSON.stringify(++count === 1 ? spoofed : [owned()])),
    "visuals",
  );
  assert.equal(result.shouldRun, false);
  assert.equal(count, 2);
});

test("native checkbox edits tolerate line-ending normalization but not other content edits", () => {
  const event = toggle();
  event.changes.body.from = event.changes.body.from
    .trimEnd()
    .replaceAll("\n", "\r\n");
  event.comment.body = event.comment.body.trimEnd();
  assert.equal(isVisualRerunToggle(event, appSlug), true);
  event.comment.body = event.comment.body.replace(
    "Prior results",
    "Changed prose",
  );
  assert.equal(isVisualRerunToggle(event, appSlug), false);
});
