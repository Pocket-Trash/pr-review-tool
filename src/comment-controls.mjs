import { createHash } from "node:crypto";
import { validateTask } from "./review.mjs";

export const COMMENT_MARKER = "<!-- pockettrash:pr-review -->";
export const VISUAL_COMMENT_MARKER = "<!-- pockettrash:pr-visuals -->";
export const VISUAL_RERUN_FOOTER =
  "\n\n<!-- pockettrash:visuals-rerun -->\n- [ ] Manually rerun\n";

export function withVisualRerun(body, task) {
  return task === "visuals" ? `${body.trimEnd()}${VISUAL_RERUN_FOOTER}` : body;
}

export function findOwnedMarkerComment(comments, appSlug, task = "review") {
  validateTask(task);
  const marker = task === "visuals" ? VISUAL_COMMENT_MARKER : COMMENT_MARKER;
  return comments.find(
    (comment) =>
      comment.user?.type === "Bot" &&
      comment.user?.login?.toLowerCase() === `${appSlug}[bot]`.toLowerCase() &&
      (task === "visuals"
        ? comment.body === marker || comment.body?.startsWith(`${marker}\n`)
        : comment.body?.includes(marker)),
  );
}

export function laneRunStamp(task, runId, runAttempt = "1") {
  if (!/^\d+$/.test(String(runId)) || !/^\d+$/.test(String(runAttempt)))
    throw new TypeError(
      "lane publication requires a numeric workflow run and attempt",
    );
  return `<!-- pockettrash:pr-${task}-run ${runId}:${runAttempt} -->\n`;
}

export class StaleReviewError extends Error {}

export function assertLaneRunOrder(comment, task, runId, runAttempt = "1") {
  const previous = comment?.body?.match(
    new RegExp(`(?:^|\\n)<!-- pockettrash:pr-${task}-run (\\d+):(\\d+) -->`),
  );
  if (
    previous &&
    (BigInt(previous[1]) > BigInt(runId) ||
      (BigInt(previous[1]) === BigInt(runId) &&
        BigInt(previous[2]) > BigInt(runAttempt)))
  )
    throw new StaleReviewError(
      `refusing to overwrite a newer ${task === "visuals" ? "visual" : "review"} run`,
    );
}

export function visualAdmissionStamp(event, runId, runAttempt = "1") {
  laneRunStamp("visuals", runId, runAttempt);
  const request = createHash("sha256")
    .update(
      JSON.stringify([
        event.action,
        event.pull_request?.number,
        event.pull_request?.head?.sha,
        event.comment?.id,
        event.comment?.updated_at,
        event.comment?.body,
        event.changes?.body?.from,
        event.sender?.id,
      ]),
    )
    .digest("hex");
  return `<!-- pockettrash:visuals-admitted ${runId}:${runAttempt}:${request} -->`;
}

export function isVisualRerunToggle(event, appSlug) {
  const normalize = (body) =>
    typeof body === "string" ? body.replaceAll("\r\n", "\n").trimEnd() : "";
  const before = normalize(event.changes?.body?.from);
  const footer = VISUAL_RERUN_FOOTER.trimEnd();
  if (
    event.action !== "edited" ||
    event.sender?.type !== "User" ||
    !findOwnedMarkerComment([event.comment ?? {}], appSlug, "visuals") ||
    !before.endsWith(footer)
  )
    return false;
  return ["x", "X"].some(
    (checked) =>
      normalize(event.comment.body) ===
      before.slice(0, -footer.length) + footer.replace("[ ]", `[${checked}]`),
  );
}
