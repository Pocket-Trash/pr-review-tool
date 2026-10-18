const automaticActions = new Set(["opened", "synchronize", "ready_for_review"]);
const manualPermissions = new Set(["write", "maintain", "admin"]);
const API = "https://api.github.com";

function required(value, path) {
  if (value === undefined || value === null || value === "")
    throw new TypeError(`${path} is required`);
  return value;
}

export function resolveAutomaticEvent(event) {
  if (!automaticActions.has(event?.action))
    return {
      shouldRun: false,
      reason: `unsupported action: ${event?.action ?? "missing"}`,
    };
  if (event.pull_request?.draft)
    return { shouldRun: false, reason: "draft pull request" };

  return {
    shouldRun: true,
    repository: required(event.repository?.full_name, "repository.full_name"),
    pullNumber: required(event.pull_request?.number, "pull_request.number"),
    baseSha: required(event.pull_request?.base?.sha, "pull_request.base.sha"),
    headSha: required(event.pull_request?.head?.sha, "pull_request.head.sha"),
    fork: required(
      event.pull_request?.head?.repo?.fork,
      "pull_request.head.repo.fork",
    ),
  };
}

function normalizedCommand(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

async function githubJson(path, token, fetch) {
  const response = await fetch(`${API}${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!response.ok)
    throw new Error(`GitHub event request failed: ${response.status}`);
  return response.json();
}

export async function resolveReviewEvent(
  event,
  token,
  fetch = globalThis.fetch,
) {
  if (event?.pull_request) return resolveAutomaticEvent(event);
  if (event?.action !== "created")
    return {
      shouldRun: false,
      reason: `unsupported action: ${event?.action ?? "missing"}`,
    };
  if (!event.issue?.pull_request)
    return { shouldRun: false, reason: "comment is not on a pull request" };
  if (normalizedCommand(event.comment?.body) !== "!pockettrash review")
    return { shouldRun: false, reason: "comment is not the review command" };
  if (!token) throw new TypeError("GITHUB_TOKEN is required");

  const repository = required(
    event.repository?.full_name,
    "repository.full_name",
  );
  const pullNumber = required(event.issue?.number, "issue.number");
  const commenter = required(event.comment?.user?.login, "comment.user.login");
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) throw new TypeError("repository must be owner/name");
  const [pull, permission] = await Promise.all([
    githubJson(`/repos/${owner}/${repo}/pulls/${pullNumber}`, token, fetch),
    githubJson(
      `/repos/${owner}/${repo}/collaborators/${encodeURIComponent(commenter)}/permission`,
      token,
      fetch,
    ),
  ]);
  const authorized = manualPermissions.has(permission.permission);
  if (!authorized)
    return { shouldRun: false, reason: "commenter is not authorized" };
  if (pull.state !== "open")
    return { shouldRun: false, reason: "pull request is not open" };
  if (pull.draft) return { shouldRun: false, reason: "draft pull request" };

  return {
    shouldRun: true,
    repository,
    pullNumber,
    baseSha: required(pull.base?.sha, "pull_request.base.sha"),
    headSha: required(pull.head?.sha, "pull_request.head.sha"),
    fork: required(pull.head?.repo?.fork, "pull_request.head.repo.fork"),
  };
}
