import {
  renderReview,
  validateConfig,
  validateReview,
  validateRun,
  validateTask,
  validateVisualAnalysis,
} from "./review.mjs";
import { sanitizeVisuals } from "./visuals.mjs";

export const COMMENT_MARKER = "<!-- pockettrash:pr-review -->";
export const CHECK_NAME = "Pocket Trash PR Review";
export const VISUAL_COMMENT_MARKER = "<!-- pockettrash:pr-visuals -->";
export const VISUAL_CHECK_NAME = "Pocket Trash PR Visuals";
export const COMMENT_LIMIT = 60_000;
const conclusions = new Set([
  "success",
  "neutral",
  "failure",
  "timed_out",
  "cancelled",
]);

export function sanitizePublishedText(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/<!--([\s\S]*?)-->/g, "&lt;!--$1--&gt;")
    .replace(/<\/?[a-z][^>]*>/gi, (tag) =>
      tag.replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
    )
    .replace(/\]\(\s*(?:javascript|data):/gi, "](blocked:")
    .replace(/@(?!\u200b)(?=[\w-])/g, "@\u200b");
}

function sanitizeReview(review, task) {
  return {
    overview: sanitizePublishedText(review.overview),
    ...(task === "visuals"
      ? {}
      : {
          findings: review.findings.map((finding) =>
            Object.fromEntries(
              Object.entries(finding).map(([key, value]) => [
                key,
                typeof value === "string"
                  ? sanitizePublishedText(value)
                  : value,
              ]),
            ),
          ),
        }),
    diagrams: review.diagrams.map((diagram) => ({
      ...diagram,
      title: sanitizePublishedText(diagram.title),
    })),
    changedAreas: review.changedAreas.map((area) => ({
      area: sanitizePublishedText(area.area),
      summary: sanitizePublishedText(area.summary),
    })),
    coverageGaps: review.coverageGaps.map(sanitizePublishedText),
  };
}

function operationalBody(conclusion, detail, runUrl, task, reviewedSha) {
  const status = conclusion.replaceAll("_", " ");
  const safeDetail = sanitizePublishedText(
    detail || "No diagnostic was available.",
  );
  const safeRunUrl =
    /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+$/.test(
      runUrl || "",
    )
      ? runUrl
      : null;
  const visualOnly = task === "visuals";
  return `${visualOnly ? "## PR Visuals\n\n" : ""}## Overview\n\nThe automated ${visualOnly ? "visual analysis" : "review"} ended with an operational **${status}** result.\n\n${visualOnly ? "" : "## Findings\n\nNo advisory findings were published because analysis did not complete successfully.\n\n"}## Architecture and schema\n\nNo diagram was published.\n\n## Changed areas\n\n- ${visualOnly ? "Visual analysis" : "Review"} system only; pull-request changes were not assessed.\n\n## Coverage gaps\n\n- ${safeDetail}\n\n<details>\n<summary>Run and cost details</summary>\n\nConclusion: ${status}${visualOnly && reviewedSha ? `\nReviewed SHA: ${sanitizePublishedText(reviewedSha)}` : ""}${safeRunUrl ? `\nRun: ${safeRunUrl}` : ""}\n\n</details>\n`;
}

export async function preparePublication(artifact, fallback = {}) {
  const task = validateTask(fallback.task);
  if (task === "visuals" && artifact?.task !== "visuals")
    throw new TypeError("visual publication requires a visual artifact");
  if (artifact?.task && artifact.task !== task)
    throw new TypeError("artifact task does not match the publication lane");
  if (artifact?.config && validateTask(artifact.config.task) !== task)
    throw new TypeError(
      "artifact configuration does not match the publication lane",
    );
  if (task === "visuals" && artifact?.review != null)
    validateVisualAnalysis(artifact.review);
  if (
    fallback.reviewedSha &&
    artifact?.run &&
    artifact.run.reviewedSha !== fallback.reviewedSha
  )
    throw new TypeError("artifact SHA does not match the publication SHA");
  const marker = task === "visuals" ? VISUAL_COMMENT_MARKER : COMMENT_MARKER;
  const stamp =
    task === "visuals"
      ? visualRunStamp(fallback.runId, fallback.runAttempt)
      : "";
  const conclusion = conclusions.has(artifact?.conclusion)
    ? artifact.conclusion
    : conclusions.has(fallback.conclusion)
      ? fallback.conclusion
      : "failure";
  let content;
  if (conclusion === "success") {
    const config = validateConfig(artifact.config);
    const review = await sanitizeVisuals(
      sanitizeReview(
        task === "visuals"
          ? validateVisualAnalysis(artifact.review)
          : validateReview(artifact.review),
        task,
      ),
    );
    const run = validateRun(artifact.run);
    content = renderReview(config, review, {
      ...run,
      selectedSkills: run.selectedSkills.map(sanitizePublishedText),
      skillOverrides: run.skillOverrides.map(sanitizePublishedText),
    });
  } else {
    content = operationalBody(
      conclusion,
      artifact?.diagnostics?.join("; ") || fallback.detail,
      fallback.runUrl,
      task,
      fallback.reviewedSha,
    );
  }
  const prefix = `${marker}\n${stamp}`;
  let body = `${prefix}${content}`;
  if (body.length > COMMENT_LIMIT) {
    body = `${prefix}${operationalBody(
      "failure",
      `Rendered review exceeded the ${COMMENT_LIMIT.toLocaleString("en-US")} character limit.`,
      fallback.runUrl,
      task,
      fallback.reviewedSha,
    )}`;
    return { body, conclusion: "failure" };
  }
  return { body, conclusion };
}

export function findOwnedMarkerComment(comments, appSlug, task = "review") {
  validateTask(task);
  const marker = task === "visuals" ? VISUAL_COMMENT_MARKER : COMMENT_MARKER;
  const expectedLogin = `${appSlug}[bot]`.toLowerCase();
  return comments.find(
    (comment) =>
      comment.user?.type === "Bot" &&
      comment.user?.login?.toLowerCase() === expectedLogin &&
      comment.body?.includes(marker),
  );
}

export class StaleReviewError extends Error {}

function visualRunStamp(runId, runAttempt = "1") {
  if (!/^\d+$/.test(String(runId)) || !/^\d+$/.test(String(runAttempt)))
    throw new TypeError(
      "visual publication requires a numeric workflow run and attempt",
    );
  return `<!-- pockettrash:pr-visuals-run ${runId}:${runAttempt} -->\n`;
}

function assertVisualRunOrder(comment, runId, runAttempt = "1") {
  const previous = comment?.body?.match(
    /(?:^|\n)<!-- pockettrash:pr-visuals-run (\d+):(\d+) -->/,
  );
  if (
    previous &&
    (BigInt(previous[1]) > BigInt(runId) ||
      (BigInt(previous[1]) === BigInt(runId) &&
        BigInt(previous[2]) > BigInt(runAttempt)))
  )
    throw new StaleReviewError("refusing to overwrite a newer visual run");
}

export async function publishReview({
  task = "review",
  runId,
  runAttempt = "1",
  artifact,
  token,
  repository,
  pullNumber,
  expectedHeadSha,
  authenticatedAppSlug,
  expectedAppSlug = "pockettrash",
  runUrl,
  fetch = globalThis.fetch,
}) {
  validateTask(task);
  if (task === "visuals") visualRunStamp(runId, runAttempt);
  const checkName = task === "visuals" ? VISUAL_CHECK_NAME : CHECK_NAME;
  if (!token) throw new TypeError("GitHub App token is required");
  if (authenticatedAppSlug !== expectedAppSlug)
    throw new Error(`unexpected GitHub App slug: ${authenticatedAppSlug}`);
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) throw new TypeError("repository must be owner/name");
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-github-api-version": "2022-11-28",
  };
  const request = async (path, options = {}) => {
    const response = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });
    if (!response.ok)
      throw new Error(`GitHub publication request failed: ${response.status}`);
    return response.status === 204 ? null : response.json();
  };
  const pull = await request(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
  if (pull.head?.sha !== expectedHeadSha)
    throw new StaleReviewError("refusing to publish a stale review");

  let publication;
  try {
    publication = await preparePublication(artifact, {
      task,
      runId,
      runAttempt,
      reviewedSha: expectedHeadSha,
      conclusion: artifact?.conclusion,
      runUrl,
    });
  } catch (error) {
    publication = await preparePublication(
      {
        task,
        conclusion: "failure",
        diagnostics: [
          "Review artifact validation failed. Inspect the protected workflow logs for details.",
        ],
      },
      { task, runId, runAttempt, runUrl, reviewedSha: expectedHeadSha },
    );
  }
  const externalId = `pockettrash-pr-${task === "visuals" ? "visuals" : "review"}:${repository}#${pullNumber}`;
  const checkRuns = await request(
    `/repos/${owner}/${repo}/commits/${expectedHeadSha}/check-runs?check_name=${encodeURIComponent(checkName)}`,
  );
  const existingCheck = checkRuns.check_runs?.find(
    (check) =>
      check.external_id === externalId &&
      check.app?.slug === authenticatedAppSlug,
  );
  const currentPull = await request(
    `/repos/${owner}/${repo}/pulls/${pullNumber}`,
  );
  if (currentPull.head?.sha !== expectedHeadSha)
    throw new StaleReviewError("refusing to overwrite a newer review");
  const comments = [];
  for (let page = 1; ; page += 1) {
    const batch = await request(
      `/repos/${owner}/${repo}/issues/${pullNumber}/comments?per_page=100&page=${page}`,
    );
    comments.push(...batch);
    if (batch.length < 100) break;
  }
  const existingComment = findOwnedMarkerComment(
    comments,
    authenticatedAppSlug,
    task,
  );
  if (task === "visuals")
    assertVisualRunOrder(existingComment, runId, runAttempt);
  const latestPull = await request(
    `/repos/${owner}/${repo}/pulls/${pullNumber}`,
  );
  if (latestPull.head?.sha !== expectedHeadSha)
    throw new StaleReviewError("refusing to overwrite a newer review");
  const check = existingCheck
    ? await request(`/repos/${owner}/${repo}/check-runs/${existingCheck.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "in_progress",
          started_at: new Date().toISOString(),
        }),
      })
    : await request(`/repos/${owner}/${repo}/check-runs`, {
        method: "POST",
        body: JSON.stringify({
          name: checkName,
          head_sha: expectedHeadSha,
          external_id: externalId,
          status: "in_progress",
        }),
      });

  try {
    if (existingComment)
      await request(
        `/repos/${owner}/${repo}/issues/comments/${existingComment.id}`,
        { method: "PATCH", body: JSON.stringify({ body: publication.body }) },
      );
    else
      await request(`/repos/${owner}/${repo}/issues/${pullNumber}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: publication.body }),
      });
    await request(`/repos/${owner}/${repo}/check-runs/${check.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "completed",
        conclusion: publication.conclusion,
        completed_at: new Date().toISOString(),
        output: {
          title: `${checkName}: ${publication.conclusion}`,
          summary: `The persistent review comment was updated for ${expectedHeadSha}.`,
        },
      }),
    });
    return publication;
  } catch (error) {
    try {
      await request(`/repos/${owner}/${repo}/check-runs/${check.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "completed",
          conclusion: "failure",
          completed_at: new Date().toISOString(),
          output: {
            title: `${checkName}: publication failed`,
            summary: sanitizePublishedText(error.message),
          },
        }),
      });
    } catch {
      // Preserve the original publication error.
    }
    throw error;
  }
}
