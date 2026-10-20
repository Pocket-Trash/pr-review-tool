import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  COMMENT_MARKER,
  VISUAL_COMMENT_MARKER,
  VISUAL_CHECK_NAME,
  StaleReviewError,
  findOwnedMarkerComment,
  preparePublication,
  publishReview,
} from "../src/publication.mjs";

const fixture = async (name) =>
  JSON.parse(
    await readFile(new URL(`fixtures/${name}`, import.meta.url), "utf8"),
  );
const artifact = {
  task: "visuals",
  conclusion: "success",
  config: await fixture("config.visuals.json"),
  review: await fixture("visuals.valid.json"),
  run: { ...(await fixture("run.valid.json")), runId: "100" },
  diagnostics: [],
};
const options = {
  task: "visuals",
  runId: "100",
  runAttempt: "1",
  reviewedSha: artifact.run.reviewedSha,
};

test("visual publication sanitizes prose and diagrams without adding review findings", async () => {
  const input = structuredClone(artifact);
  input.review.overview = `@owner <script>x</script> ${VISUAL_COMMENT_MARKER}`;
  input.review.diagrams.push({
    kind: "architecture",
    title: "Unsafe",
    mermaid: "flowchart LR\nA-->B\nclick A https://example.com",
  });
  const publication = await preparePublication(input, options);
  assert.equal(publication.conclusion, "success");
  assert.ok(publication.body.startsWith(VISUAL_COMMENT_MARKER));
  assert.match(publication.body, /pr-visuals-run 100:1/);
  assert.match(publication.body, /## PR Visuals/);
  assert.match(publication.body, /@\u200bowner/);
  assert.match(publication.body, /unsafe Mermaid/);
  assert.doesNotMatch(
    publication.body,
    /## Findings|<script>|click A|pockettrash:pr-review/,
  );
  assert.equal(publication.body.split(VISUAL_COMMENT_MARKER).length, 2);
});

test("visual publication rejects cross-lane identity, findings, and wrong SHA", async () => {
  for (const input of [
    { ...artifact, task: "review" },
    { ...artifact, task: undefined },
    { ...artifact, config: { ...artifact.config, task: "review" } },
    { ...artifact, review: { ...artifact.review, findings: [] } },
    { ...artifact, run: { ...artifact.run, reviewedSha: "older" } },
  ])
    await assert.rejects(
      preparePublication(input, options),
      /artifact|unknown fields/,
    );
  await assert.rejects(preparePublication(artifact), /lane/);
  await assert.rejects(
    preparePublication(artifact, { task: "visuals" }),
    /numeric workflow run/,
  );
});

test("neutral/failure/timeout/cancelled visual states remove diagrams and identify the current SHA", async () => {
  for (const conclusion of ["neutral", "failure", "timed_out", "cancelled"]) {
    const publication = await preparePublication(
      {
        task: "visuals",
        conclusion,
        diagnostics: ["No eligible changes; inference skipped."],
      },
      options,
    );
    assert.equal(publication.conclusion, conclusion);
    assert.match(publication.body, /No diagram was published/);
    assert.match(
      publication.body,
      new RegExp(`Reviewed SHA: ${artifact.run.reviewedSha}`),
    );
    assert.doesNotMatch(publication.body, /```mermaid|## Findings/);
  }
});

test("visual marker lookup cannot select the review comment or a spoofed App", () => {
  const owned = {
    id: 2,
    user: { type: "Bot", login: "pockettrash[bot]" },
    body: VISUAL_COMMENT_MARKER,
  };
  assert.equal(
    findOwnedMarkerComment(
      [
        { ...owned, id: 1, body: COMMENT_MARKER },
        { ...owned, id: 3, user: { type: "User", login: "pockettrash[bot]" } },
        owned,
      ],
      "pockettrash",
      "visuals",
    ),
    owned,
  );
});

function mockPublication(previousRun = "99:1") {
  const calls = [];
  const response = (body) => new Response(JSON.stringify(body));
  const fetch = async (url, request = {}) => {
    const method = request.method || "GET";
    calls.push({ url, method, body: request.body && JSON.parse(request.body) });
    if (url.endsWith("/pulls/7"))
      return response({ head: { sha: artifact.run.reviewedSha } });
    if (url.includes("/check-runs?")) {
      assert.match(url, /Pocket%20Trash%20PR%20Visuals/);
      return response({
        check_runs: [
          {
            id: 11,
            external_id: "pockettrash-pr-visuals:Pocket-Trash/example#7",
            app: { slug: "pockettrash" },
          },
        ],
      });
    }
    if (url.includes("/issues/7/comments?"))
      return response([
        {
          id: 21,
          user: { type: "Bot", login: "pockettrash[bot]" },
          body: COMMENT_MARKER,
        },
        {
          id: 22,
          user: { type: "Bot", login: "pockettrash[bot]" },
          body: `${VISUAL_COMMENT_MARKER}\n<!-- pockettrash:pr-visuals-run ${previousRun} -->\nOld diagrams`,
        },
      ]);
    if (url.endsWith("/check-runs/11")) return response({ id: 11 });
    if (url.endsWith("/issues/comments/22")) return response({ id: 22 });
    throw new Error(`unexpected publication request: ${method} ${url}`);
  };
  return { fetch, calls };
}
const publishOptions = {
  task: "visuals",
  runId: "100",
  runAttempt: "1",
  artifact,
  token: "fixture-token",
  repository: "Pocket-Trash/example",
  pullNumber: 7,
  expectedHeadSha: artifact.run.reviewedSha,
  authenticatedAppSlug: "pockettrash",
};

test("missing required visuals fail publication and clear only stale visual lane content", async () => {
  const mock = mockPublication();
  const input = {
    ...artifact,
    visualRequirements: { architecture: true, schema: "none" },
    visualValidation: { version: "visual-validation-v1", attempts: [] },
    review: {
      ...artifact.review,
      diagrams: [
        {
          kind: "architecture",
          title: "Unsafe",
          mermaid: 'flowchart LR\n A --> B\n click A "https://example.com"',
        },
      ],
    },
  };
  const publication = await publishReview({
    ...publishOptions,
    artifact: input,
    fetch: mock.fetch,
  });
  assert.equal(publication.conclusion, "failure");
  const writes = mock.calls.filter((call) => call.method !== "GET");
  const comment = writes.find((call) =>
    call.url.endsWith("/issues/comments/22"),
  );
  assert.match(comment.body.body, /Required visual diagrams are missing/);
  assert.doesNotMatch(comment.body.body, /```mermaid|Old diagrams/);
  assert.ok(!writes.some((call) => call.url.endsWith("/issues/comments/21")));
});

test("same-SHA visual reruns update only the visual App comment/check", async () => {
  for (const conclusion of ["success", "neutral", "failure"]) {
    const mock = mockPublication("100:1");
    const input =
      conclusion === "success"
        ? artifact
        : { task: "visuals", conclusion, diagnostics: ["Skipped"] };
    const publication = await publishReview({
      ...publishOptions,
      runAttempt: "2",
      artifact: input,
      fetch: mock.fetch,
    });
    assert.equal(publication.conclusion, conclusion);
    const writes = mock.calls.filter(({ method }) => method !== "GET");
    assert.ok(writes.some(({ url }) => url.endsWith("/issues/comments/22")));
    assert.ok(
      !writes.some(
        ({ url }) =>
          url.endsWith("/issues/comments/21") ||
          url.endsWith("/issues/7/comments"),
      ),
    );
    assert.equal(
      writes.at(-1).body.output.title,
      `${VISUAL_CHECK_NAME}: ${conclusion}`,
    );
    assert.match(
      writes.find(({ url }) => url.endsWith("/issues/comments/22")).body.body,
      /pr-visuals-run 100:2/,
    );
  }
});

test("older visual run IDs/attempts cannot mutate either the current comment or check", async () => {
  for (const previous of ["101:1", "100:2"]) {
    const mock = mockPublication(previous);
    await assert.rejects(
      publishReview({ ...publishOptions, fetch: mock.fetch }),
      StaleReviewError,
    );
    assert.deepEqual(
      mock.calls.filter(({ method }) => method !== "GET"),
      [],
    );
  }
});

test("cross-lane artifacts publish only a fixed visual failure, never the review content", async () => {
  const mock = mockPublication();
  const publication = await publishReview({
    ...publishOptions,
    artifact: {
      ...artifact,
      task: "review",
      review: { ...artifact.review, findings: [] },
    },
    fetch: mock.fetch,
  });
  assert.equal(publication.conclusion, "failure");
  assert.match(publication.body, /artifact validation failed/);
  assert.doesNotMatch(publication.body, /Staged queue|```mermaid|## Findings/);
});
