import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const repository = "Pocket-Trash/pr-review-tool";

function gh(args, { input, inherit = false } = {}) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    input,
    stdio: inherit ? "inherit" : ["pipe", "pipe", "inherit"],
  });
  if (result.error || result.status !== 0)
    throw new Error(
      "GitHub CLI failed; check authentication and the run above.",
    );
  return result.stdout;
}

export function release(args, { runGh = gh, write = console.log } = {}) {
  const options = args[0] === "--" ? args.slice(1) : args;
  if (
    options.length !== 0 &&
    (options.length !== 2 ||
      options[0] !== "--sha" ||
      !/^[a-f\d]{40}$/i.test(options[1]))
  )
    throw new Error("Usage: pnpm release [--sha <full-commit-sha>]");
  const sha = options[1]?.toLowerCase() || "";
  const dispatched = JSON.parse(
    runGh(
      [
        "api",
        "--method",
        "POST",
        "-H",
        "X-GitHub-Api-Version: 2026-03-10",
        `/repos/${repository}/actions/workflows/promote-release.yml/dispatches`,
        "--input",
        "-",
      ],
      { input: JSON.stringify({ ref: "main", inputs: { sha } }) },
    ),
  );
  if (
    !Number.isSafeInteger(dispatched.workflow_run_id) ||
    dispatched.workflow_run_id < 1
  )
    throw new Error(
      "Dispatch returned no run ID. Check Actions before retrying; a release may already be queued.",
    );
  const url = `https://github.com/${repository}/actions/runs/${dispatched.workflow_run_id}`;
  write(`Promotion run and audit summary: ${url}`);
  runGh(
    [
      "run",
      "watch",
      String(dispatched.workflow_run_id),
      "--repo",
      repository,
      "--exit-status",
    ],
    { inherit: true },
  );
  write(`Promotion completed. Audit summary: ${url}#summary`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    release(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
