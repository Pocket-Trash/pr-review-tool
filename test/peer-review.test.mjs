import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  peerFindings,
  critiqueFormat,
  combinePeerReviews,
  peerEvidence,
} from "../src/peer-review.mjs";
const review = JSON.parse(
  await readFile(
    new URL("./fixtures/review.valid.json", import.meta.url),
    "utf8",
  ),
);
const finding = {
  severity: "medium",
  title: "Verify source",
  file: "src/file.mjs",
  line: 1,
  evidence: "Source evidence",
  impact: "Consequence",
  recommendation: "Small fix",
};
const initial = () => ({ ...review, findings: [finding] });
const verdict = (value = "accept") => ({
  assessments: [
    {
      findingId: "finding-1",
      verdict: value,
      evidence: "src/file.mjs:1",
      reason: "Checked frozen source",
    },
  ],
});
test("peer verdicts must cover every original finding exactly once", () => {
  const format = critiqueFormat(peerFindings(initial()));
  assert.deepEqual(format.validate(verdict()), verdict());
  for (const value of [
    { assessments: [] },
    { assessments: [...verdict().assessments, ...verdict().assessments] },
    { assessments: [{ ...verdict().assessments[0], findingId: "other" }] },
    verdict("maybe"),
  ])
    assert.throws(() => format.validate(value));
  assert.match(
    peerEvidence(peerFindings(initial())),
    /# finding-1\nseverity: medium/,
  );
});
test("combined findings use the opposite critic's verdict and never rewrite originals", () => {
  const second = {
    ...initial(),
    findings: [{ ...finding, title: "Second finding", line: 2 }],
  };
  const result = combinePeerReviews(
    [initial(), second],
    [verdict("reject"), verdict()],
  );
  assert.deepEqual(result.review.findings, [finding]);
  assert.equal(result.dispositions[0].critic, 1);
  assert.equal(result.dispositions[1].verdict, "reject");
  assert.ok(
    result.review.coverageGaps.some((gap) =>
      gap.includes("peer verdict reject"),
    ),
  );
  assert.ok(
    result.review.coverageGaps.every(
      (gap) => !gap.includes("Checked frozen source"),
    ),
  );
  assert.equal(
    combinePeerReviews([initial(), initial()], [verdict(), verdict()]).review
      .findings.length,
    1,
  );
  assert.equal(
    combinePeerReviews(
      [initial(), initial()],
      [verdict("uncertain"), verdict("uncertain")],
    ).review.findings.length,
    0,
  );
});
