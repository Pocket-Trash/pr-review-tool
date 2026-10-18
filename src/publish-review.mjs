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
const pull = event.pull_request;
if (!pull?.number || !pull.head?.sha || !event.repository?.full_name)
  throw new TypeError("publisher requires a pull_request event");
await publishReview({
  artifact: artifact || {
    conclusion: process.env.ANALYSIS_CONCLUSION || "failure",
    diagnostics: [
      process.env.ANALYSIS_DETAIL || "Analysis produced no artifact.",
    ],
  },
  token: process.env.GITHUB_APP_TOKEN,
  repository: event.repository.full_name,
  pullNumber: pull.number,
  expectedHeadSha: artifact?.run?.reviewedSha || pull.head.sha,
  authenticatedAppSlug: process.env.GITHUB_AUTHENTICATED_APP_SLUG,
  expectedAppSlug: process.env.GITHUB_APP_SLUG || "pockettrash",
  runUrl: `${event.repository.html_url}/actions/runs/${process.env.GITHUB_RUN_ID}`,
});
