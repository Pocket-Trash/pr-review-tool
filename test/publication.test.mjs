import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CHECK_NAME,
  COMMENT_LIMIT,
  COMMENT_MARKER,
  StaleReviewError,
  findOwnedMarkerComment,
  preparePublication,
  publishReview,
} from "../src/publication.mjs";

const fixture = async (name) =>
  JSON.parse(
    await readFile(new URL(`fixtures/${name}`, import.meta.url), "utf8"),
  );

async function successArtifact() {
  return {
    conclusion: "success",
    config: await fixture("config.valid.json"),
    review: await fixture("review.valid.json"),
    run: await fixture("run.valid.json"),
    diagnostics: [],
  };
}

test("publication preserves the six sections while sanitizing model prose", async () => {
  const artifact = await successArtifact();
  artifact.review.overview =
    "Ping @maintainer <script>alert(1)</script> <!-- pockettrash:pr-review --> [x](javascript:alert(1))";
  artifact.review.findings = [
    {
      severity: "critical",
      title: "Advisory finding",
      file: "src/a.mjs",
      line: 1,
      evidence: "Evidence",
      impact: "Impact",
      recommendation: "Fix",
    },
  ];
  artifact.review.diagrams = [
    {
      kind: "architecture",
      title: "Unsafe",
      mermaid: "flowchart LR\n  A --> B\n  click A https://example.com",
    },
  ];
  const publication = await preparePublication(artifact);
  assert.equal(publication.conclusion, "success");
  assert.ok(publication.body.startsWith(COMMENT_MARKER));
  assert.match(publication.body, /@​maintainer/);
  assert.doesNotMatch(publication.body, /<script>/i);
  assert.doesNotMatch(publication.body, /\]\(javascript:/i);
  assert.equal(
    publication.body.match(/<!-- pockettrash:pr-review -->/g).length,
    1,
  );
  const headings = [
    "## Overview",
    "## Findings",
    "## Architecture and schema",
    "## Changed areas",
    "## Coverage gaps",
    "**Run and cost details**",
  ];
  let prior = -1;
  for (const heading of headings) {
    const index = publication.body.indexOf(heading);
    assert.ok(index > prior, `${heading} must be in the approved order`);
    prior = index;
  }
  assert.match(publication.body, /Omitted Unsafe: unsafe Mermaid/);
});

test("oversized publication becomes a bounded operational failure", async () => {
  const artifact = await successArtifact();
  artifact.review.overview = "x".repeat(COMMENT_LIMIT);
  const publication = await preparePublication(artifact, {
    runUrl: "https://github.com/Pocket-Trash/pr-review-tool/actions/runs/1",
  });
  assert.equal(publication.conclusion, "failure");
  assert.ok(publication.body.length <= COMMENT_LIMIT);
  assert.match(publication.body, /exceeded the 60,000 character limit/);
});

test("operational conclusions are preserved without consulting review prose", async () => {
  for (const conclusion of ["neutral", "failure", "timed_out", "cancelled"]) {
    const publication = await preparePublication({
      conclusion,
      diagnostics: [`${conclusion} diagnostic`],
    });
    assert.equal(publication.conclusion, conclusion);
    assert.match(publication.body, new RegExp(conclusion.replace("_", " ")));
  }
});

test("comment ownership requires both the App bot attribution and marker", () => {
  const owned = {
    id: 2,
    user: { type: "Bot", login: "pockettrash[bot]" },
    body: COMMENT_MARKER,
  };
  assert.equal(
    findOwnedMarkerComment(
      [
        {
          id: 1,
          user: { type: "Bot", login: "other[bot]" },
          body: COMMENT_MARKER,
        },
        owned,
      ],
      "pockettrash",
    ),
    owned,
  );
});

test("publisher updates the App-owned comment and check idempotently", async () => {
  const calls = [];
  const artifact = await successArtifact();
  const response = (body, status = 200) =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  const fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    calls.push({ url, method, body: options.body && JSON.parse(options.body) });
    if (url.endsWith("/pulls/7"))
      return response({ head: { sha: artifact.run.reviewedSha } });
    if (url.includes("/commits/") && url.includes("/check-runs?"))
      return response({
        check_runs: [
          {
            id: 11,
            external_id: "pockettrash-pr-review:Pocket-Trash/example#7",
            app: { slug: "pockettrash" },
          },
        ],
      });
    if (url.includes("/issues/7/comments?"))
      return response([
        {
          id: 22,
          user: { type: "Bot", login: "pockettrash[bot]" },
          body: COMMENT_MARKER,
        },
      ]);
    if (url.endsWith("/check-runs/11")) return response({ id: 11 });
    if (url.endsWith("/issues/comments/22")) return response({ id: 22 });
    throw new Error(`unexpected request: ${method} ${url}`);
  };
  const publication = await publishReview({
    artifact,
    token: "app-token",
    repository: "Pocket-Trash/example",
    pullNumber: 7,
    expectedHeadSha: artifact.run.reviewedSha,
    authenticatedAppSlug: "pockettrash",
    fetch,
  });
  assert.equal(publication.conclusion, "success");
  assert.ok(
    calls.some(
      ({ url, method }) =>
        method === "PATCH" && url.endsWith("/issues/comments/22"),
    ),
  );
  assert.equal(
    calls.filter(
      ({ method, url }) =>
        method === "POST" && url.endsWith("/issues/7/comments"),
    ).length,
    0,
  );
  const completed = calls.find(
    ({ url, body }) =>
      url.endsWith("/check-runs/11") && body?.status === "completed",
  );
  assert.equal(completed.body.conclusion, "success");
  assert.equal(completed.body.output.title, `${CHECK_NAME}: success`);
});

test("publisher refuses all writes when the pull request head is stale", async () => {
  const writes = [];
  const fetch = async (url, options = {}) => {
    if ((options.method || "GET") !== "GET") writes.push({ url, options });
    if (url.endsWith("/pulls/7"))
      return new Response(JSON.stringify({ head: { sha: "newer" } }));
    throw new Error(`unexpected request: ${url}`);
  };
  await assert.rejects(
    publishReview({
      artifact: { conclusion: "failure", diagnostics: ["failed"] },
      token: "app-token",
      repository: "Pocket-Trash/example",
      pullNumber: 7,
      expectedHeadSha: "older",
      authenticatedAppSlug: "pockettrash",
      fetch,
    }),
    StaleReviewError,
  );
  assert.deepEqual(writes, []);
});

test("publisher rechecks the head immediately before comment mutation", async () => {
  const writes = [];
  let pullReads = 0;
  const response = (body) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  const fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    if (method !== "GET") writes.push({ url, options });
    if (url.endsWith("/pulls/7")) {
      pullReads += 1;
      return response({ head: { sha: pullReads < 3 ? "older" : "newer" } });
    }
    if (url.includes("/commits/") && url.includes("/check-runs?"))
      return response({ check_runs: [] });
    if (url.endsWith("/check-runs")) return response({ id: 11 });
    if (url.includes("/issues/7/comments?")) return response([]);
    if (url.endsWith("/check-runs/11")) return response({ id: 11 });
    throw new Error(`unexpected request: ${method} ${url}`);
  };
  await assert.rejects(
    publishReview({
      artifact: { conclusion: "failure", diagnostics: ["failed"] },
      token: "app-token",
      repository: "Pocket-Trash/example",
      pullNumber: 7,
      expectedHeadSha: "older",
      authenticatedAppSlug: "pockettrash",
      fetch,
    }),
    StaleReviewError,
  );
  assert.equal(writes.filter(({ url }) => url.includes("/issues/")).length, 0);
});
