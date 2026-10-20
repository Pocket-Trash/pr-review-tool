import { validateConfig, validateTask } from "./review.mjs";

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

export async function loadChangedFile(
  identity,
  file,
  token,
  fetch = globalThis.fetch,
) {
  const [owner, repository] = identity.repository.split("/");
  const path = file.filename.split("/").map(encodeURIComponent).join("%2F");
  const ref = file.status === "removed" ? identity.baseSha : identity.headSha;
  const response = await githubJson(
    `/repos/${owner}/${repository}/contents/${path}?ref=${encodeURIComponent(ref)}`,
    token,
    fetch,
  );
  if (response.encoding !== "base64")
    return { size: response.size ?? 0, content: "", available: false };
  return {
    size: response.size,
    content: Buffer.from(response.content, "base64").toString("utf8"),
  };
}

export async function loadRepositoryFile(
  identity,
  filename,
  token,
  fetch = globalThis.fetch,
  maxBytes = Infinity,
  ref = identity.headSha,
) {
  if (![identity.baseSha, identity.headSha].includes(ref))
    throw new TypeError("repository evidence must use a frozen base/head ref");
  if (
    !filename ||
    filename.startsWith("/") ||
    filename.includes("\0") ||
    filename.split("/").includes("..")
  )
    throw new TypeError("unsafe repository evidence path");
  const [owner, repository] = identity.repository.split("/");
  const path = filename.split("/").map(encodeURIComponent).join("%2F");
  const response = await fetch(
    `${API}/repos/${owner}/${repository}/contents/${path}?ref=${encodeURIComponent(ref)}`,
    {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
      },
    },
  );
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`GitHub API request failed: ${response.status}`);
  const body = await response.json();
  if (body.encoding !== "base64") return null;
  if (body.size > maxBytes) return null;
  const content = Buffer.from(body.content, "base64").toString("utf8");
  if (Buffer.byteLength(content) > maxBytes) return null;
  return {
    filename,
    content,
  };
}

export async function loadBaseEvidence(
  identity,
  file,
  token,
  maxBytes,
  fetch = globalThis.fetch,
) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1)
    throw new TypeError("base evidence requires a positive file byte limit");
  let baseContent;
  if (file.status === "added") baseContent = "";
  else if (file.status === "removed") baseContent = file.content;
  else {
    const base = await loadRepositoryFile(
      identity,
      file.previous_filename || file.filename,
      token,
      fetch,
      maxBytes,
      identity.baseSha,
    );
    if (!base) return null;
    baseContent = base.content;
  }
  if (
    typeof baseContent !== "string" ||
    Buffer.byteLength(baseContent) > maxBytes
  )
    return null;
  return { baseContent, baseSha: identity.baseSha, headSha: identity.headSha };
}

export async function assertCurrentHead(
  identity,
  token,
  fetch = globalThis.fetch,
) {
  const [owner, repository] = identity.repository.split("/");
  const pull = await githubJson(
    `/repos/${owner}/${repository}/pulls/${identity.pullNumber}`,
    token,
    fetch,
  );
  if (pull.head?.sha !== identity.headSha)
    throw new Error("stale pull request head SHA");
}

export function buildArtifact({
  conclusion,
  config,
  task,
  review,
  run,
  selectedSkills,
  omissions,
  diagnostics,
}) {
  validateTask(task);
  const artifact = JSON.stringify(
    {
      conclusion,
      config,
      ...(task ? { task } : {}),
      review,
      run,
      selectedSkills,
      omissions,
      diagnostics,
    },
    null,
    2,
  );
  if (Buffer.byteLength(artifact) > ARTIFACT_LIMIT)
    throw new RangeError("review artifact exceeds the 1 MiB limit");
  return `${artifact}\n`;
}
