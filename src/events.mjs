const automaticActions = new Set(["opened", "synchronize", "ready_for_review"]);

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
