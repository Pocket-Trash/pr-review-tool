import {
  renderReview,
  validateConfig,
  validateReview,
  validateRun,
  validateTask,
  validateVisualAnalysis,
  validateVisualPhase,
  validateCodeReview,
} from "./review.mjs";
import { sanitizeVisuals, missingRequiredVisuals } from "./visuals.mjs";
import { githubRequestError } from "./events.mjs";
import {
  COMMENT_MARKER,
  VISUAL_COMMENT_MARKER,
  findOwnedMarkerComment,
  laneRunStamp,
  withVisualRerun,
  assertLaneRunOrder,
  StaleReviewError,
} from "./comment-controls.mjs";
export {
  COMMENT_MARKER,
  VISUAL_COMMENT_MARKER,
  findOwnedMarkerComment,
  StaleReviewError,
} from "./comment-controls.mjs";

export const CHECK_NAME = "Pocket Trash PR Review";
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

function sanitizeReview(review) {
  return {
    overview: sanitizePublishedText(review.overview),
    ...(review.findings
      ? {
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
        }
      : {}),
    ...(review.diagrams
      ? {
          diagrams: review.diagrams.map((diagram) => ({
            ...diagram,
            title: sanitizePublishedText(diagram.title),
          })),
        }
      : {}),
    changedAreas: review.changedAreas.map((area) => ({
      area: sanitizePublishedText(area.area),
      summary: sanitizePublishedText(area.summary),
    })),
    coverageGaps: review.coverageGaps.map(sanitizePublishedText),
  };
}

function operationalBody(
  conclusion,
  detail,
  runUrl,
  task,
  reviewedSha,
  reviewOnly = false,
) {
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
  if (visualOnly)
    return `## PR Visuals\n\n## Analysis status\n\n${conclusion === "neutral" ? "No diagrams were generated." : `No diagrams were published because visual analysis ${conclusion === "timed_out" ? "timed out" : conclusion === "cancelled" ? "was cancelled" : "failed"}.`}\n\nReason: ${safeDetail}\n\n<details>\n<summary>Run and cost details</summary>\n\nConclusion: ${status}${reviewedSha ? `\nRequested SHA: ${sanitizePublishedText(reviewedSha)}` : ""}${safeRunUrl ? `\nRun: ${safeRunUrl}` : ""}\n\n</details>\n`;
  return `${visualOnly ? "## PR Visuals\n\n" : reviewOnly ? "## PR Review\n\n" : ""}## Overview\n\nThe automated ${visualOnly ? "visual analysis" : "review"} ended with an operational **${status}** result.\n\n${visualOnly ? "" : "## Findings\n\nNo advisory findings were published because analysis did not complete successfully.\n\n"}${reviewOnly ? "" : "## Architecture and schema\n\nNo diagram was published.\n\n"}## Changed areas\n\n- ${visualOnly ? "Visual analysis" : "Review"} system only; pull-request changes were not assessed.\n\n## Coverage gaps\n\n- ${safeDetail}\n\n<details>\n<summary>Run and cost details</summary>\n\nConclusion: ${status}${(visualOnly || reviewOnly) && reviewedSha ? `\nReviewed SHA: ${sanitizePublishedText(reviewedSha)}` : ""}${safeRunUrl ? `\nRun: ${safeRunUrl}` : ""}\n\n</details>\n`;
}

export async function preparePublication(artifact, fallback = {}) {
  const task = validateTask(fallback.task);
  const reviewOnly = fallback.reviewOnly === true;
  if (reviewOnly && task !== "review")
    throw new TypeError("review-only publication requires the review lane");
  const stamp =
    task === "visuals" || reviewOnly
      ? laneRunStamp(task, fallback.runId, fallback.runAttempt)
      : "";
  const visualPhase = validateVisualPhase(fallback.visualPhase);
  if (validateVisualPhase(artifact?.config?.visualPhase) > visualPhase)
    throw new TypeError(
      "artifact visual phase is not activated in this workflow",
    );
  if ((task === "visuals" || reviewOnly) && artifact?.task !== task)
    throw new TypeError(
      `${task === "visuals" ? "visual" : "review-only"} publication requires a ${task === "visuals" ? "visual" : "review-only"} artifact`,
    );
  if (artifact?.task && artifact.task !== task)
    throw new TypeError("artifact task does not match the publication lane");
  if (artifact?.config && validateTask(artifact.config.task) !== task)
    throw new TypeError(
      "artifact configuration does not match the publication lane",
    );
  if (task === "visuals" && artifact?.review != null)
    validateVisualAnalysis(artifact.review, artifact.config?.visualPhase);
  if (reviewOnly && artifact?.config && artifact.config.task !== "review")
    throw new TypeError(
      "review-only publication requires explicit review configuration",
    );
  if (reviewOnly && artifact?.review != null)
    validateCodeReview(artifact.review);
  if (
    (task === "visuals" || reviewOnly) &&
    artifact?.run &&
    String(artifact.run.runId) !== String(fallback.runId)
  )
    throw new TypeError("artifact run does not match the publication run");
  if (
    fallback.reviewedSha &&
    artifact?.run &&
    artifact.run.reviewedSha !== fallback.reviewedSha
  )
    throw new TypeError("artifact SHA does not match the publication SHA");
  const marker = task === "visuals" ? VISUAL_COMMENT_MARKER : COMMENT_MARKER;
  const conclusion = conclusions.has(artifact?.conclusion)
    ? artifact.conclusion
    : conclusions.has(fallback.conclusion)
      ? fallback.conclusion
      : "failure";
  let content;
  if (conclusion === "success") {
    const config = validateConfig(artifact.config);
    const sanitized = sanitizeReview(
      task === "visuals"
        ? validateVisualAnalysis(artifact.review, config.visualPhase)
        : reviewOnly
          ? validateCodeReview(artifact.review)
          : validateReview(artifact.review),
    );
    const review = reviewOnly
      ? sanitized
      : await sanitizeVisuals(
          sanitized,
          task === "visuals" ? artifact.visualRequirements : undefined,
        );
    if (
      task === "visuals" &&
      artifact.visualValidation &&
      !artifact.visualRequirements
    )
      throw new TypeError(
        "Visual validation requires trusted eligibility metadata",
      );
    if (
      task === "visuals" &&
      missingRequiredVisuals(review, artifact.visualRequirements).length
    )
      return {
        conclusion: "failure",
        body: withVisualRerun(
          `${marker}\n${stamp}${operationalBody("failure", "Required visual diagrams are missing after publication validation.", fallback.runUrl, task, fallback.reviewedSha, reviewOnly)}`,
          task,
        ),
      };
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
      reviewOnly,
    );
  }
  const prefix = `${marker}\n${stamp}`;
  let body = withVisualRerun(`${prefix}${content}`, task);
  if (body.length > COMMENT_LIMIT) {
    body = withVisualRerun(
      `${prefix}${operationalBody(
        "failure",
        `Rendered review exceeded the ${COMMENT_LIMIT.toLocaleString("en-US")} character limit.`,
        fallback.runUrl,
        task,
        fallback.reviewedSha,
        reviewOnly,
      )}`,
      task,
    );
    return { body, conclusion: "failure" };
  }
  return { body, conclusion };
}

export async function publishReview({
  task = "review",
  reviewOnly = false,
  visualPhase = 1,
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
  if (typeof reviewOnly !== "boolean" || (reviewOnly && task !== "review"))
    throw new TypeError("review-only publication requires the review lane");
  if (task === "visuals" || reviewOnly) laneRunStamp(task, runId, runAttempt);
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
      throw await githubRequestError(response, "GitHub publication request");
    return response.status === 204 ? null : response.json();
  };
  const pull = await request(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
  if (pull.head?.sha !== expectedHeadSha)
    throw new StaleReviewError("refusing to publish a stale review");

  let publication;
  try {
    publication = await preparePublication(artifact, {
      task,
      reviewOnly,
      visualPhase,
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
      {
        task,
        reviewOnly,
        visualPhase,
        runId,
        runAttempt,
        runUrl,
        reviewedSha: expectedHeadSha,
      },
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
  if (task === "visuals" || reviewOnly)
    assertLaneRunOrder(existingComment, task, runId, runAttempt);
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
