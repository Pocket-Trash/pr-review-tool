import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

const SHA = /^[0-9a-f]{40}$/;
const CLI = /^skills@\d+\.\d+\.\d+$/;

function globRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("**/", "<globstar-slash>")
    .replaceAll("**", "<globstar>")
    .replaceAll("*", "[^/]*")
    .replaceAll("<globstar-slash>", "(?:.*/)?")
    .replaceAll("<globstar>", ".*");
  return new RegExp(`^${escaped}$`);
}

export function validateSkillManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || !CLI.test(manifest.cli))
    throw new TypeError("skill manifest CLI must use an exact version");
  if (!Array.isArray(manifest.sources) || manifest.sources.length > 8)
    throw new TypeError("skill manifest must contain at most 8 sources");
  const names = new Set();
  for (const source of manifest.sources) {
    if (
      !/^[\w.-]+\/[\w.-]+$/.test(source.repository) ||
      !SHA.test(source.commit)
    )
      throw new TypeError(
        "skill sources require a repository and full commit SHA",
      );
    if (!Array.isArray(source.skills))
      throw new TypeError("skill source skills must be an array");
    for (const skill of source.skills) {
      if (!skill?.name || names.has(skill.name))
        throw new TypeError("skill names must be present and unique");
      names.add(skill.name);
    }
  }
  if (names.size > 24)
    throw new TypeError("skill manifest must install at most 24 skills");
  return manifest;
}

function frontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  return Object.fromEntries(
    match[1].split(/\r?\n/).flatMap((line) => {
      const separator = line.indexOf(":");
      if (separator < 0) return [];
      return [
        [line.slice(0, separator).trim(), line.slice(separator + 1).trim()],
      ];
    }),
  );
}

export async function discoverInstalledSkills(root) {
  const installed = new Map();
  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name === "SKILL.md") {
        const metadata = frontmatter(await readFile(path, "utf8"));
        const name = metadata.name;
        if (!name || !metadata.description || name !== basename(directory))
          continue;
        installed.set(name, {
          name,
          directory,
          manualOnly:
            metadata["disable-model-invocation"] === "true" ||
            metadata["user-invocable"] === "false",
        });
      }
    }
  }
  await visit(root);
  return installed;
}

export async function loadSkillInstallFailures(path) {
  try {
    const status = JSON.parse(await readFile(path, "utf8"));
    return Array.isArray(status.failures)
      ? status.failures.map(({ skill }) => skill).filter(Boolean)
      : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export function packageManifestPaths(files) {
  const paths = new Set(["package.json"]);
  for (const file of files) {
    const [scope, name] = file.filename.split("/");
    if (["apps", "packages", "services"].includes(scope) && name)
      paths.add(`${scope}/${name}/package.json`);
  }
  return [...paths];
}

export function summarizePackageEvidence(
  files,
  { maxEntries = 200, maxBytes = 64 * 1024 } = {},
) {
  const evidence = [];
  let remaining = maxEntries;
  for (const file of files) {
    if (remaining === 0) break;
    try {
      const pkg = JSON.parse(file.content);
      const dependencies = [];
      for (const group of [
        "dependencies",
        "devDependencies",
        "peerDependencies",
      ]) {
        for (const [name, version] of Object.entries(pkg[group] || {})) {
          if (remaining-- === 0) break;
          const dependency = {
            group,
            name: name.slice(0, 256),
            version: String(version).slice(0, 256),
          };
          const candidate = [
            ...evidence,
            {
              filename: file.filename.slice(0, 512),
              dependencies: [...dependencies, dependency],
            },
          ];
          if (Buffer.byteLength(JSON.stringify(candidate)) > maxBytes) {
            remaining = 0;
            break;
          }
          dependencies.push(dependency);
        }
        if (remaining === 0) break;
      }
      if (dependencies.length)
        evidence.push({
          filename: file.filename.slice(0, 512),
          dependencies,
        });
    } catch {
      // Invalid manifests cannot provide trustworthy installed-version evidence.
    }
  }
  return evidence;
}

function evidence(files) {
  const paths = files.map((file) => file.filename);
  const dependencies = new Set();
  const owners = new Set();
  for (const file of files) {
    const parts = file.filename.split("/");
    if (["apps", "packages", "services"].includes(parts[0]) && parts[1])
      owners.add(`${parts[0]}/${parts[1]}`);
    if (!file.filename.endsWith("package.json") || !file.content) continue;
    try {
      const pkg = JSON.parse(file.content);
      for (const group of [
        pkg.dependencies,
        pkg.devDependencies,
        pkg.peerDependencies,
      ])
        for (const name of Object.keys(group || {})) dependencies.add(name);
    } catch {
      // Invalid package JSON remains review evidence but cannot select a specialist.
    }
  }
  return { paths, dependencies, owners };
}

export function selectRelevantSkills({
  manifest,
  installed,
  files,
  configured = [],
  failed = [],
}) {
  validateSkillManifest(manifest);
  const { paths, dependencies, owners } = evidence(files);
  const configuredNames = new Set(configured);
  const selected = ["review-coordinator"];
  const overrides = [];
  const coverageGaps = [];
  const failedNames = new Set(failed);

  for (const source of manifest.sources) {
    for (const skill of source.skills) {
      const pathMatch = (skill.paths || []).some((pattern) => {
        const regex = globRegex(pattern);
        return paths.some((path) => regex.test(path));
      });
      const dependencyMatch = (skill.dependencies || []).some((dependency) =>
        dependencies.has(dependency),
      );
      const ownerMatch = (skill.owners || []).some((owner) =>
        owners.has(owner),
      );
      const relevant =
        skill.mandatory ||
        configuredNames.has(skill.name) ||
        pathMatch ||
        dependencyMatch ||
        ownerMatch;
      if (!relevant) continue;
      const available = installed.get(skill.name);
      if (failedNames.has(skill.name))
        coverageGaps.push(
          `Pinned specialist ${skill.name} failed to install; a bundled fallback is used when available.`,
        );
      if (!available) {
        if (!failedNames.has(skill.name))
          coverageGaps.push(
            `Specialist ${skill.name} was relevant but unavailable.`,
          );
        continue;
      }
      selected.push(skill.name);
      if (available.manualOnly) {
        overrides.push(
          `${skill.name}: model-invocation metadata overridden by trusted selection`,
        );
      }
    }
  }
  return {
    selected: [...new Set(selected)],
    overrides,
    coverageGaps,
  };
}

export function filterSkillOverrides(overrides, selected) {
  return overrides.filter((override) =>
    selected.some((skill) => override.startsWith(`${skill}:`)),
  );
}
