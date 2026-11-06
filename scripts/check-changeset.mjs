import { readFile } from "node:fs/promises";

const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const number = event.pull_request?.number;
if (!Number.isSafeInteger(number) || number < 1)
  throw new Error("Pull request number is required.");
const repository = "Pocket-Trash/pr-review-tool";
if (process.env.GITHUB_REPOSITORY !== repository)
  throw new Error("Unexpected repository.");
async function request(path) {
  const response = await fetch(
    `https://api.github.com/repos/${repository}${path}`,
    {
      headers: {
        authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        accept: "application/vnd.github+json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok)
    throw new Error(`Changeset API failed (HTTP ${response.status}).`);
  return response.json();
}
const pull = await request(`/pulls/${number}`);
if (!/^[a-f\d]{40}$/.test(pull.head?.sha))
  throw new Error("Invalid pull request head.");
let valid = false;
for (let page = 1; page <= 30; page += 1) {
  const files = await request(
    `/pulls/${number}/files?per_page=100&page=${page}`,
  );
  if (!Array.isArray(files)) throw new Error("Invalid changed file response.");
  for (const file of files) {
    if (
      file.status === "removed" ||
      !/^\.changeset\/[\w-]+\.md$/.test(file.filename)
    )
      continue;
    const content = await request(
      `/contents/${encodeURIComponent(file.filename)}?ref=${pull.head.sha}`,
    );
    if (content.encoding !== "base64" || typeof content.content !== "string")
      throw new Error("Invalid Changeset content.");
    const text = Buffer.from(content.content, "base64").toString("utf8");
    if (
      /^---\r?\n["']?@pocket-trash\/pr-review-tool["']?: (patch|minor|major)\r?\n---\r?\n\s*\S/.test(
        text,
      )
    )
      valid = true;
  }
  if (files.length < 100) break;
  if (page === 30)
    throw new Error("Changed file list exceeds the validation limit.");
}
if (!valid)
  throw new Error(
    "A valid Changeset for @pocket-trash/pr-review-tool is required.",
  );
console.log("Valid reviewer Changeset found.");
