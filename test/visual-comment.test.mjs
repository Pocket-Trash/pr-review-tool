import test from "node:test";
import assert from "node:assert/strict";
import {
  visualCommentGaps,
  visualEvidenceLink,
} from "../src/visual-comment.mjs";
test("comment groups repeated diagnostics while preserving meaningful limitations", () => {
  const input = [
    "Runner evidence: supplied file; no-confirmed-read",
    "Runner graph scope: 3 of 89 nodes",
    "schema: trusted generated-file pattern",
    ...Array.from(
      { length: 50 },
      (_, n) =>
        `Runner relationship limitation: schema.ts:${n}: CHECK constraints are not represented`,
    ),
    "Runner relationship limitation: schema.ts: FK evidence is unsupported or incomplete",
    "Unsafe Mermaid click directive was omitted.",
  ];
  const output = visualCommentGaps(input);
  assert.equal(output.length, 3);
  assert.match(output.join(" "), /Constraint semantics/);
  assert.match(output.join(" "), /could not be represented/);
  assert.match(output.join(" "), /Unsafe Mermaid/);
  assert.equal(input.length, 55);
  assert.doesNotMatch(output.join(" "), /no-confirmed-read|3 of 89|schema.ts/);
});
test("artifact navigation uses a validated workflow URL and keeps unsafe URLs out", () => {
  assert.match(
    visualEvidenceLink(
      "https://github.com/Pocket-Trash/pocket-trash/actions/runs/123",
    ),
    /123#artifacts/,
  );
  assert.doesNotMatch(visualEvidenceLink("javascript:alert(1)"), /javascript/);
});
