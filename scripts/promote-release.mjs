import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const repository = "Pocket-Trash/pr-review-tool";
const shaPattern = /^[a-f\d]{40}$/;

export async function promoteRelease({
  env = process.env,
  fetch = globalThis.fetch,
  summary = (text) => appendFile(env.GITHUB_STEP_SUMMARY, text),
} = {}) {
  let previous = "unknown",
    selected = "unresolved",
    ci = "not verified",
    outcome = "failed";
  const request = async (path, method = "GET", body, allowMissing = false) => {
    const response = await fetch(
      `https://api.github.com/repos/${repository}${path}`,
      {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "content-type": "application/json",
          "x-github-api-version": "2026-03-10",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    if (allowMissing && response.status === 404) return null;
    if (!response.ok)
      throw new Error(
        `Release API request failed: ${method} ${path} (HTTP ${response.status})`,
      );
    return response.json();
  };
  try {
    if (
      env.GITHUB_REPOSITORY !== repository ||
      env.GITHUB_REF !== "refs/heads/main" ||
      env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
      env.GITHUB_WORKFLOW_REF !==
        `${repository}/.github/workflows/promote-release.yml@refs/heads/main`
    )
      throw new Error(
        "Promotion must be manually dispatched from this repository's trusted main workflow.",
      );
    if (!env.GITHUB_TOKEN) throw new Error("GitHub token is required.");
    for (const actor of new Set([
      env.GITHUB_ACTOR,
      env.GITHUB_TRIGGERING_ACTOR,
    ])) {
      if (!/^[a-z\d][a-z\d-]*$/i.test(actor || ""))
        throw new Error("Invalid release actor.");
      const access = await request(
        `/collaborators/${encodeURIComponent(actor)}/permission`,
      );
      if (
        access.permission !== "admin" &&
        !(
          access.permission === "write" &&
          access.user?.permissions?.maintain === true
        )
      )
        throw new Error(
          "Only repository admins or maintainers may promote releases.",
        );
    }
    const input = env.RELEASE_SHA || "";
    if (input && !shaPattern.test(input))
      throw new Error("Release SHA must be a full lowercase commit SHA.");
    const main = await request("/git/ref/heads/main");
    if (!shaPattern.test(main.object?.sha))
      throw new Error("Invalid main SHA.");
    selected = input || main.object.sha;
    const comparison = await request(
      `/compare/${selected}...${main.object.sha}`,
    );
    if (
      !["ahead", "identical"].includes(comparison.status) ||
      comparison.merge_base_commit?.sha !== selected
    )
      throw new Error("Selected commit must belong to main history.");
    const runs = await request(
      `/actions/workflows/test.yml/runs?head_sha=${selected}&branch=main&event=push&per_page=100`,
    );
    const matching = runs.workflow_runs
      ?.filter(
        (run) =>
          run.head_sha === selected &&
          run.head_branch === "main" &&
          run.event === "push" &&
          run.path === ".github/workflows/test.yml",
      )
      .sort((a, b) => b.id - a.id);
    const testRun = matching?.[0];
    if (testRun?.status !== "completed" || testRun.conclusion !== "success")
      throw new Error(
        "The exact selected SHA needs a completed, passing main Test workflow.",
      );
    ci = `https://github.com/${repository}/actions/runs/${testRun.id}`;
    const existing = await request(
      "/git/ref/tags/current-release",
      "GET",
      undefined,
      true,
    );
    if (
      existing &&
      (existing.object?.type !== "commit" ||
        !shaPattern.test(existing.object.sha))
    )
      throw new Error("current-release must be a lightweight commit tag.");
    previous = existing?.object.sha || "none (initial release)";
    const conflicting = await request(
      "/git/ref/heads/current-release",
      "GET",
      undefined,
      true,
    );
    if (conflicting)
      throw new Error(
        "A current-release branch already exists; refusing an ambiguous release reference.",
      );
    if (previous === selected) {
      outcome = "no-op (already current)";
      return;
    }
    const updated = existing
      ? await request("/git/refs/tags/current-release", "PATCH", {
          sha: selected,
          force: true,
        })
      : await request("/git/refs", "POST", {
          ref: "refs/tags/current-release",
          sha: selected,
        });
    if (updated.object?.sha !== selected)
      throw new Error(
        "Tag update did not confirm the selected SHA; inspect the reference before retrying.",
      );
    outcome = "promoted";
  } finally {
    const actor = /^[a-z\d][a-z\d-]*$/i.test(env.GITHUB_TRIGGERING_ACTOR || "")
      ? env.GITHUB_TRIGGERING_ACTOR
      : "unknown";
    await summary(
      `## Current release promotion\n\n- Actor: ${actor}\n- Time (UTC): ${new Date().toISOString()}\n- Previous SHA: ${previous}\n- Selected SHA: ${selected}\n- CI: ${ci}\n- Outcome: ${outcome}\n`,
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  promoteRelease().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
