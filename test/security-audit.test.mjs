import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAuditReport } from "../scripts/security-audit.mjs";

test("blocks all high and critical advisories", () => {
  const result = evaluateAuditReport({
    advisories: {
      1: { github_advisory_id: "GHSA-high", severity: "high" },
      2: { github_advisory_id: "GHSA-critical", severity: "critical" },
      3: { github_advisory_id: "GHSA-moderate", severity: "moderate" },
    },
  });

  assert.deepEqual(result, {
    blocking: ["GHSA-high", "GHSA-critical"],
  });
});
