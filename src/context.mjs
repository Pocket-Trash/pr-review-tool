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

function safePath(path) {
  return (
    typeof path === "string" &&
    path !== "" &&
    !path.startsWith("/") &&
    !path.includes("\0") &&
    !path.split("/").includes("..")
  );
}

export async function prepareReviewContext(files, config, loadFile) {
  const patterns = config.generatedFiles.map(globRegex);
  const omissions = [];
  const candidates = [];

  for (const file of files) {
    if (!safePath(file.filename))
      throw new TypeError(`unsafe file path: ${file.filename}`);
    if (patterns.some((pattern) => pattern.test(file.filename)))
      omissions.push(`${file.filename}: trusted generated-file pattern`);
    else candidates.push(file);
  }

  if (candidates.length > config.limits.maxFiles) {
    return {
      conclusion: "neutral",
      reason: `reviewable file limit exceeded (${candidates.length}/${config.limits.maxFiles})`,
      files: [],
      omissions,
    };
  }
  const changedLines = candidates.reduce(
    (total, file) => total + file.additions + file.deletions,
    0,
  );
  if (changedLines > config.limits.maxChangedLines) {
    return {
      conclusion: "neutral",
      reason: `changed line limit exceeded (${changedLines}/${config.limits.maxChangedLines})`,
      files: [],
      omissions,
    };
  }
  const bytes = candidates.reduce(
    (total, file) => total + Buffer.byteLength(file.patch ?? ""),
    0,
  );
  if (bytes > config.limits.maxBytes) {
    return {
      conclusion: "neutral",
      reason: `reviewable byte limit exceeded (${bytes}/${config.limits.maxBytes})`,
      files: [],
      omissions,
    };
  }

  const reviewable = [];
  for (const file of candidates) {
    const loaded = await loadFile(file);
    if (loaded.size > config.limits.maxFileBytes)
      omissions.push(`${file.filename}: file exceeds 512 KiB`);
    else reviewable.push({ ...file, content: loaded.content });
  }
  return { conclusion: "review", files: reviewable, omissions };
}
