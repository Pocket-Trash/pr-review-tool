import {
  resolveReviewEvent,
  visualComments,
  githubJson,
  githubRequestError,
} from "./events.mjs";
import {
  VISUAL_COMMENT_MARKER,
  findOwnedMarkerComment,
  laneRunStamp,
  visualAdmissionStamp,
  assertLaneRunOrder,
  withVisualRerun,
} from "./comment-controls.mjs";

// Called only inside the serialized visual lane, with App credentials and no model key.
export async function admitVisualRun({
  event,
  token,
  authenticatedAppSlug,
  appSlug,
  runId,
  runAttempt = "1",
  pullNumber,
  fetch = globalThis.fetch,
}) {
  if (!token || !appSlug || authenticatedAppSlug !== appSlug)
    throw new Error("Visual admission requires the expected GitHub App");
  const stamp = visualAdmissionStamp(event, runId, runAttempt);
  const identity = await resolveReviewEvent(event, token, fetch, "visuals", {
    appSlug,
    runId,
    runAttempt,
  });
  if (!identity.shouldRun) return identity;
  if (pullNumber !== undefined && pullNumber !== identity.pullNumber)
    throw new Error("Visual admission does not match the serialized PR");
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
  if (existing?.body?.includes(stamp) || (event.pull_request && existing))
    return { shouldRun: false, reason: "visual request already claimed" };
  if (
    event.action === "edited" &&
    (existing?.id !== event.comment.id || existing.body !== event.comment.body)
  )
    return {
      shouldRun: false,
      reason: "rerun checkbox changed before admission",
    };
  assertLaneRunOrder(existing, "visuals", runId, runAttempt);
  const pull = await githubJson(
    `/repos/${identity.repository}/pulls/${identity.pullNumber}`,
    token,
    fetch,
  );
  if (
    pull.state !== "open" ||
    pull.draft ||
    pull.head?.sha !== identity.headSha
  )
    return {
      shouldRun: false,
      reason: "pull request closed, draft or changed before admission",
    };
  const command = event.action === "created" && !event.pull_request;
  if (
    command &&
    (!Number.isSafeInteger(event.comment?.id) || event.comment.id < 1)
  )
    throw new Error("Invalid visual command comment ID");
  const runUrl = `https://github.com/${identity.repository}/actions/runs/${runId}`;
  const body = withVisualRerun(
    `${VISUAL_COMMENT_MARKER}\n${laneRunStamp("visuals", runId, runAttempt)}${stamp}\n## PR Visuals\n\nVisual analysis requested for SHA ${identity.headSha}. Results are pending; no diagrams are current yet.\n\n[Workflow run](${runUrl}/attempts/${runAttempt})\n\nEach manual rerun uses the approved model and incurs inference cost.`,
    "visuals",
  );
  const path = existing
    ? `/repos/${identity.repository}/issues/comments/${existing.id}`
    : `/repos/${identity.repository}/issues/${identity.pullNumber}/comments`;
  const response = await fetch(`https://api.github.com${path}`, {
    method: existing ? "PATCH" : "POST",
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({ body }),
  });
  if (!response.ok)
    throw await githubRequestError(response, "GitHub visual admission");
  if (command) {
    try {
      const reaction = await fetch(
        `https://api.github.com/repos/${identity.repository}/issues/comments/${event.comment.id}/reactions`,
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          headers: {
            accept: "application/vnd.github+json",
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            "x-github-api-version": "2022-11-28",
          },
          body: JSON.stringify({ content: "eyes" }),
        },
      );
      if (!reaction.ok)
        throw await githubRequestError(reaction, "GitHub visual reaction");
    } catch (error) {
      return {
        ...identity,
        acknowledgementWarning:
          error instanceof Error &&
          error.message.startsWith("GitHub visual reaction failed:")
            ? error.message
            : "GitHub visual reaction request failed; the pending comment was posted.",
      };
    }
  }
  return identity;
}
