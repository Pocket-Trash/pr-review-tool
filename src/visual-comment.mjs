// Full diagnostics stay in the artifact; comments describe the visual's practical limits.
export function visualCommentGaps(gaps) {
  const result = new Set();
  for (const gap of gaps) {
    if (
      /^(?:Runner evidence:|Runner (?:visual|graph|fact) scope:)|trusted generated-file pattern$/.test(
        gap,
      )
    )
      continue;
    if (
      /^Omitted .*: (?:architecture|schema-domain|schema-er) was not eligible/.test(
        gap,
      )
    )
      continue;
    if (
      /CHECK constraints|Runner semantic scope:|SQL migration declarations|not deployed infrastructure/.test(
        gap,
      )
    ) {
      result.add(
        "Constraint semantics, runtime behavior and SQL migration agreement with the schema were not assessed.",
      );
      continue;
    }
    if (/unsupported|incomplete|ambiguous|dynamic table/i.test(gap)) {
      result.add(
        "Some declarations or relationships could not be represented. See the evidence artifact for the affected source.",
      );
      continue;
    }
    if (
      /(?:catalogue|catalogued|candidate set).*omitted|diagram cap|visual-scope limit|omission details not listed/i.test(
        gap,
      )
    ) {
      result.add(
        "The diagram is a bounded slice; additional entities and relationships are omitted.",
      );
      continue;
    }
    result.add(gap.replace(/^Runner relationship limitation: /, ""));
  }
  const items = [...result];
  return items.length <= 5
    ? items
    : [
        ...items.slice(0, 4),
        `${items.length - 4} additional limitations are listed in the evidence artifact.`,
      ];
}

export function visualEvidenceLink(url) {
  return typeof url === "string" &&
    /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/[1-9]\d*(?:\/attempts\/[1-9]\d*)?$/.test(
      url,
    )
    ? `[Detailed evidence and diagnostics](${url}#artifacts) are in the downloadable run artifact.`
    : "Detailed evidence and diagnostics are in the downloadable workflow artifact.";
}
