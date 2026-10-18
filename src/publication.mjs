import {
  renderReview,
  validateConfig,
  validateReview,
  validateRun,
} from "./review.mjs";
import { sanitizeVisuals } from "./visuals.mjs";

export const COMMENT_MARKER = "<!-- pockettrash:pr-review -->";
export const CHECK_NAME = "Pocket Trash PR Review";
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
    findings: review.findings.map((finding) =>
      Object.fromEntries(
        Object.entries(finding).map(([key, value]) => [
          key,
          typeof value === "string" ? sanitizePublishedText(value) : value,
        ]),
      ),
    ),
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

function operationalBody(conclusion, detail, runUrl) {
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
  return `## Overview\n\nThe automated review ended with an operational **${status}** result.\n\n## Findings\n\nNo advisory findings were published because analysis did not complete successfully.\n\n## Architecture and schema\n\nNo diagram was published.\n\n## Changed areas\n\n- Review system only; pull-request changes were not assessed.\n\n## Coverage gaps\n\n- ${safeDetail}\n\n<details>\n<summary>Run and cost details</summary>\n\nConclusion: ${status}${safeRunUrl ? `\nRun: ${safeRunUrl}` : ""}\n\n</details>\n`;
}

export async function preparePublication(artifact, fallback = {}) {
  const conclusion = conclusions.has(artifact?.conclusion)
    ? artifact.conclusion
    : conclusions.has(fallback.conclusion)
      ? fallback.conclusion
      : "failure";
  let content;
  if (conclusion === "success") {
    const config = validateConfig(artifact.config);
    const review = await sanitizeVisuals(
      sanitizeReview(validateReview(artifact.review)),
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
    );
  }
  let body = `${COMMENT_MARKER}\n${content}`;
  if (body.length > COMMENT_LIMIT) {
    body = `${COMMENT_MARKER}\n${operationalBody(
      "failure",
      `Rendered review exceeded the ${COMMENT_LIMIT.toLocaleString("en-US")} character limit.`,
      fallback.runUrl,
    )}`;
    return { body, conclusion: "failure" };
  }
  return { body, conclusion };
}

export function findOwnedMarkerComment(comments, appSlug) {
  const expectedLogin = `${appSlug}[bot]`.toLowerCase();
  return comments.find(
    (comment) =>
      comment.user?.type === "Bot" &&
      comment.user?.login?.toLowerCase() === expectedLogin &&
      comment.body?.includes(COMMENT_MARKER),
  );
}

export class StaleReviewError extends Error {}

export async function publishReview({
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
      conclusion: artifact?.conclusion,
      runUrl,
    });
  } catch (error) {
    publication = await preparePublication(
      {
        conclusion: "failure",
        diagnostics: [
          "Review artifact validation failed. Inspect the protected workflow logs for details.",
        ],
      },
      { runUrl },
    );
  }
  const externalId = `pockettrash-pr-review:${repository}#${pullNumber}`;
  const checkRuns = await request(
    `/repos/${owner}/${repo}/commits/${expectedHeadSha}/check-runs?check_name=${encodeURIComponent(CHECK_NAME)}`,
  );
  const existingCheck = checkRuns.check_runs?.find(
    (check) =>
      check.external_id === externalId &&
      check.app?.slug === authenticatedAppSlug,
  );
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
          name: CHECK_NAME,
          head_sha: expectedHeadSha,
          external_id: externalId,
          status: "in_progress",
        }),
      });

  try {
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
    );
    const latestPull = await request(
      `/repos/${owner}/${repo}/pulls/${pullNumber}`,
    );
    if (latestPull.head?.sha !== expectedHeadSha)
      throw new StaleReviewError("refusing to overwrite a newer review");
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
          title: `${CHECK_NAME}: ${publication.conclusion}`,
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
            title: `${CHECK_NAME}: publication failed`,
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
