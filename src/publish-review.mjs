import { readFile } from "node:fs/promises";
import { publishReview } from "./publication.mjs";

const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
let artifact = null;
try {
  artifact = JSON.parse(
    await readFile(process.env.REVIEW_ARTIFACT_PATH, "utf8"),
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const pullNumber = Number(
  process.env.REVIEW_PULL_NUMBER ||
    event.pull_request?.number ||
    event.issue?.number,
);
if (!pullNumber || !event.repository?.full_name)
  throw new TypeError("publisher requires a pull request number");
const token = process.env.GITHUB_APP_TOKEN;
let expectedHeadSha =
  artifact?.run?.reviewedSha ||
  process.env.REVIEW_HEAD_SHA ||
  event.pull_request?.head?.sha;
if (!expectedHeadSha) {
  const response = await fetch(
    `https://api.github.com/repos/${event.repository.full_name}/pulls/${pullNumber}`,
    {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
      },
    },
  );
  if (!response.ok)
    throw new Error(`GitHub publication request failed: ${response.status}`);
  expectedHeadSha = (await response.json()).head?.sha;
}
if (!expectedHeadSha)
  throw new TypeError("publisher requires a pull request head SHA");
await publishReview({
  artifact: artifact || {
    conclusion: process.env.ANALYSIS_CONCLUSION || "failure",
    diagnostics: [
      process.env.ANALYSIS_DETAIL || "Analysis produced no artifact.",
    ],
  },
  token,
  repository: event.repository.full_name,
  pullNumber,
  expectedHeadSha,
  authenticatedAppSlug: process.env.GITHUB_AUTHENTICATED_APP_SLUG,
  expectedAppSlug: process.env.GITHUB_APP_SLUG || "pockettrash",
  runUrl: `${event.repository.html_url}/actions/runs/${process.env.GITHUB_RUN_ID}`,
});
