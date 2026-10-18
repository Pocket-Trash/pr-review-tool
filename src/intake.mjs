import { validateConfig } from "./review.mjs";

const API = "https://api.github.com";
const ARTIFACT_LIMIT = 1024 * 1024;

async function githubJson(path, token, fetch) {
  const response = await fetch(`${API}${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!response.ok)
    throw new Error(`GitHub API request failed: ${response.status}`);
  return response.json();
}

export async function collectInternalReviewContext(
  identity,
  configPath,
  token,
  fetch = globalThis.fetch,
) {
  if (identity.fork)
    throw new TypeError(
      "this workflow slice accepts only internal pull requests",
    );
  if (!token) throw new TypeError("GITHUB_TOKEN is required");
  const [owner, repository] = identity.repository.split("/");
  if (!owner || !repository)
    throw new TypeError("repository must be owner/name");

  const encodedPath = configPath.split("/").map(encodeURIComponent).join("%2F");
  const [configResponse, pull, comparison] = await Promise.all([
    githubJson(
      `/repos/${owner}/${repository}/contents/${encodedPath}?ref=${encodeURIComponent(identity.baseSha)}`,
      token,
      fetch,
    ),
    githubJson(
      `/repos/${owner}/${repository}/pulls/${identity.pullNumber}`,
      token,
      fetch,
    ),
    githubJson(
      `/repos/${owner}/${repository}/compare/${identity.baseSha}...${identity.headSha}`,
      token,
      fetch,
    ),
  ]);
  if (
    pull.base?.sha !== identity.baseSha ||
    pull.head?.sha !== identity.headSha
  ) {
    throw new Error(
      "pull request SHAs changed before review context was frozen",
    );
  }
  if (configResponse.encoding !== "base64")
    throw new TypeError("trusted configuration must be base64 encoded");
  const config = validateConfig(
    JSON.parse(Buffer.from(configResponse.content, "base64").toString("utf8")),
  );
  return {
    config,
    pull: { title: pull.title, body: pull.body, author: pull.user?.login },
    files: comparison.files ?? [],
    omissions: (comparison.files ?? [])
      .filter((file) => !file.patch)
      .map((file) => `${file.filename}: patch unavailable`),
  };
}

export function buildArtifact({
  review,
  run,
  selectedSkills,
  omissions,
  diagnostics,
}) {
  const artifact = JSON.stringify(
    { review, run, selectedSkills, omissions, diagnostics },
    null,
    2,
  );
  if (Buffer.byteLength(artifact) > ARTIFACT_LIMIT)
    throw new RangeError("review artifact exceeds the 1 MiB limit");
  return `${artifact}\n`;
}
