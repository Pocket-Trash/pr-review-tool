import { resolve } from "node:path";

const mergeRanges = (ranges) => {
  const merged = [];
  for (const range of ranges.sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1] + 1) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
};

// Only confirmed numbered read output counts; requested offsets and search hits do not.
export function evidenceFromEvents(inventory, events, workspace) {
  if (!inventory) return undefined;
  const calls = new Map();
  for (const [index, event] of events.entries()) {
    const part = event.part;
    if (part?.tool !== "read" || part.type !== "tool") continue;
    if (!["completed", "error"].includes(part.state?.status)) continue;
    calls.set(part.callID ?? `anonymous-${index}`, part);
  }
  const files = inventory.files.map((file) => {
    const ranges = [];
    let unknownRead = false;
    let readErrors = 0;
    let truncated = false;
    for (const call of calls.values()) {
      const path = call.state.input?.filePath;
      if (
        typeof path !== "string" ||
        resolve(workspace, path) !== resolve(workspace, file.evidencePath)
      )
        continue;
      if (call.state.status === "error") {
        readErrors++;
        continue;
      }
      truncated ||= call.state.metadata?.truncated === true;
      const output = call.state.output;
      if (typeof output !== "string") {
        unknownRead = true;
        continue;
      }
      const numbers = [...output.matchAll(/^\s*(\d+)(?:\| ?|: )/gm)].map(
        (match) => Number(match[1]),
      );
      if (
        !numbers.length ||
        numbers.some(
          (line) =>
            !Number.isSafeInteger(line) || line < 1 || line > file.lineCount,
        )
      ) {
        unknownRead = true;
        continue;
      }
      ranges.push(...numbers.map((line) => [line, line]));
    }
    const returnedRanges = mergeRanges(ranges);
    const readState =
      returnedRanges.length === 1 &&
      returnedRanges[0][0] === 1 &&
      returnedRanges[0][1] === file.lineCount
        ? "full-returned"
        : returnedRanges.length
          ? "partial-returned"
          : unknownRead
            ? "unknown"
            : readErrors
              ? "failed"
              : "no-confirmed-read";
    return { ...file, returnedRanges, readState, truncated, readErrors };
  });
  return {
    version: inventory.version,
    files,
    omissions: [...inventory.omissions],
  };
}

export function evidenceCoverage(report) {
  return report.files
    .filter(({ kind }) => kind !== "patch")
    .map((file) => {
      const ranges =
        file.returnedRanges
          .map(([start, end]) => `${start}-${end}`)
          .join(", ") || "none confirmed";
      return `Runner evidence: ${file.filename} (${file.kind}, SHA ${file.sha ?? "unknown"}) was supplied in full (${file.lineCount} lines); returned read ranges: ${ranges}; ${file.readState}${file.truncated ? "; read-tool output was truncated, not the supplied source" : ""}. Returned text does not establish comprehension.`;
    });
}
