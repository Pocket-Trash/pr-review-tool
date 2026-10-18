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
  const configResponse = await githubJson(
    `/repos/${owner}/${repository}/contents/${encodedPath}?ref=${encodeURIComponent(identity.baseSha)}`,
    token,
    fetch,
  );
  if (configResponse.encoding !== "base64")
    throw new TypeError("trusted configuration must be base64 encoded");
  const config = validateConfig(
    JSON.parse(Buffer.from(configResponse.content, "base64").toString("utf8")),
  );
  const files = await githubJson(
    `/repos/${owner}/${repository}/pulls/${identity.pullNumber}/files?per_page=100&page=1`,
    token,
    fetch,
  );
  return { config, files };
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
