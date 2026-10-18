import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSkillManifest } from "../src/skills.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const manifest = validateSkillManifest(
  JSON.parse(
    await readFile(join(repositoryRoot, "skills/manifest.json"), "utf8"),
  ),
);
const checkoutRoot = await mkdtemp(join(tmpdir(), "pr-review-skills-"));
const failures = [];

function run(command, args, cwd) {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
    },
  });
}

try {
  for (const [index, source] of manifest.sources.entries()) {
    const checkout = join(checkoutRoot, String(index));
    try {
      run(
        "git",
        ["-c", "core.hooksPath=/dev/null", "init", checkout],
        repositoryRoot,
      );
      run(
        "git",
        [
          "remote",
          "add",
          "origin",
          `https://github.com/${source.repository}.git`,
        ],
        checkout,
      );
      run(
        "git",
        [
          "-c",
          "core.hooksPath=/dev/null",
          "fetch",
          "--depth",
          "1",
          "origin",
          source.commit,
        ],
        checkout,
      );
      run(
        "git",
        [
          "-c",
          "core.hooksPath=/dev/null",
          "checkout",
          "--detach",
          "FETCH_HEAD",
        ],
        checkout,
      );
      run(
        "npx",
        [
          "--yes",
          manifest.cli,
          "add",
          checkout,
          "--agent",
          "opencode",
          "--skill",
          ...source.skills.map(({ name }) => name),
          "--copy",
          "-y",
        ],
        repositoryRoot,
      );
      for (const { name } of source.skills) {
        const candidates = [
          join(repositoryRoot, ".agents/skills", name),
          join(repositoryRoot, ".opencode/skills", name),
        ];
        let copied = false;
        for (const candidate of candidates) {
          try {
            await cp(candidate, join(repositoryRoot, "skills", name), {
              recursive: true,
              force: true,
            });
            copied = true;
            break;
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
          }
        }
        if (!copied)
          failures.push({
            skill: name,
            source: source.repository,
            reason: "installer produced no local copy",
          });
      }
    } catch (error) {
      failures.push(
        ...source.skills.map(({ name }) => ({
          skill: name,
          source: source.repository,
          reason: error.message,
        })),
      );
    }
  }
} finally {
  await rm(checkoutRoot, { recursive: true, force: true });
}

await writeFile(
  join(repositoryRoot, "skills/install-status.json"),
  `${JSON.stringify({ failures }, null, 2)}\n`,
);
if (failures.length)
  process.stderr.write(
    `${failures.map(({ skill, reason }) => `${skill}: ${reason}`).join("\n")}\n`,
  );
