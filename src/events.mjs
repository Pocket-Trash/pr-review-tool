const automaticActions = new Set(["opened", "synchronize", "ready_for_review"]);
const manualPermissions = new Set(["write", "maintain", "admin"]);
const API = "https://api.github.com";
import {
  findOwnedMarkerComment,
  isVisualRerunToggle,
  visualAdmissionStamp,
} from "./comment-controls.mjs";

function required(value, path) {
  if (value === undefined || value === null || value === "")
    throw new TypeError(`${path} is required`);
  return value;
}

export function resolveAutomaticEvent(event, task = "review") {
  if (
    !automaticActions.has(event?.action) ||
    (task === "visuals" && event?.action === "synchronize")
  )
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

export async function githubJson(path, token, fetch) {
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

export async function githubRequestError(response, operation) {
  const details = [];
  const data = await response.json().catch(() => ({}));
  if (
    [
      "Resource not accessible by integration",
      "API rate limit exceeded",
      "Bad credentials",
    ].includes(data?.message)
  )
    details.push(data.message);
  const permissions = response.headers.get("x-accepted-github-permissions");
  if (
    permissions &&
    /^[a-z_]+=(?:read|write)(?:[;, ]+[a-z_]+=(?:read|write))*$/.test(
      permissions,
    ) &&
    permissions.length <= 200
  )
    details.push(`accepted permissions: ${permissions}`);
  const requestId = response.headers.get("x-github-request-id");
  if (requestId && /^[A-Fa-f0-9:]{1,100}$/.test(requestId))
    details.push(`request: ${requestId}`);
  return new Error(
    `${operation} failed: ${response.status}${details.length ? ` (${details.join("; ")})` : ""}`,
  );
}

export async function visualComments(repository, pullNumber, token, fetch) {
  const comments = [];
  for (let page = 1; ; page++) {
    const batch = await githubJson(
      `/repos/${repository}/issues/${pullNumber}/comments?per_page=100&page=${page}`,
      token,
      fetch,
    );
    if (!Array.isArray(batch))
      throw new TypeError("Invalid GitHub comment list");
    comments.push(...batch);
    if (batch.length < 100) return comments;
  }
}

export async function resolveReviewEvent(
  event,
  token,
  fetch = globalThis.fetch,
  task = "review",
  { appSlug = "pocket-trash-pr-review", runId, runAttempt = "1" } = {},
) {
  validateTask(task);
  const admitted = (comment) =>
    runId &&
    comment?.body?.includes(visualAdmissionStamp(event, runId, runAttempt));
  if (event?.pull_request) {
    const identity = resolveAutomaticEvent(event, task);
    if (!identity.shouldRun || task !== "visuals") return identity;
    if (!token) throw new TypeError("GITHUB_TOKEN is required");
    const existing = findOwnedMarkerComment(
      await visualComments(
        identity.repository,
        identity.pullNumber,
        token,
        fetch,
      ),
      appSlug,
      "visuals",
    );
    if (existing && !admitted(existing))
      return {
        shouldRun: false,
        reason:
          "automatic visual attempt already claimed; request a manual rerun",
      };
    return identity;
  }
  const checkbox = task === "visuals" && isVisualRerunToggle(event, appSlug);
  if (event?.action !== "created" && !checkbox)
    return {
      shouldRun: false,
      reason: `unsupported action: ${event?.action ?? "missing"}`,
    };
  if (!event.issue?.pull_request)
    return { shouldRun: false, reason: "comment is not on a pull request" };
  if (
    !checkbox &&
    normalizedCommand(event.comment?.body) !==
      `!pockettrash ${task === "visuals" ? "visuals" : "review"}`
  )
    return {
      shouldRun: false,
      reason: `comment is not the ${task === "visuals" ? "visuals" : "review"} command`,
    };
  if (!token) throw new TypeError("GITHUB_TOKEN is required");

  const repository = required(
    event.repository?.full_name,
    "repository.full_name",
  );
  const pullNumber = required(event.issue?.number, "issue.number");
  const commenter = required(
    checkbox ? event.sender?.login : event.comment?.user?.login,
    "comment actor login",
  );
  if (
    task === "visuals" &&
    (checkbox ? event.sender : event.comment?.user)?.type === "Bot"
  )
    return { shouldRun: false, reason: "bot reruns are not authorized" };
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

  if (checkbox) {
    if (!Number.isSafeInteger(event.comment?.id) || event.comment.id < 1)
      return { shouldRun: false, reason: "invalid rerun comment" };
    const current = await githubJson(
      `/repos/${owner}/${repo}/issues/comments/${event.comment.id}`,
      token,
      fetch,
    );
    if (
      current.id !== event.comment.id ||
      current.issue_url !==
        `${API}/repos/${owner}/${repo}/issues/${pullNumber}` ||
      !findOwnedMarkerComment([current], appSlug, "visuals") ||
      (current.body !== event.comment.body && !admitted(current))
    )
      return {
        shouldRun: false,
        reason: "rerun checkbox was already consumed or changed",
      };
  }

  return {
    shouldRun: true,
    repository,
    pullNumber,
    baseSha: required(pull.base?.sha, "pull_request.base.sha"),
    headSha: required(pull.head?.sha, "pull_request.head.sha"),
    fork: required(pull.head?.repo?.fork, "pull_request.head.repo.fork"),
  };
}
import { validateTask } from "./review.mjs";
