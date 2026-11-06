import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const blockingSeverities = new Set(["critical", "high"]);

const severities = new Set(["info", "low", "moderate", "high", "critical"]);
const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function evaluateAuditReport(report) {
  if (
    !isRecord(report) ||
    report.error ||
    !(
      Object.hasOwn(report, "advisories") ||
      Object.hasOwn(report, "vulnerabilities")
    )
  ) {
    return { blocking: ["invalid-audit-report"] };
  }
  for (const key of ["advisories", "vulnerabilities"]) {
    if (!Object.hasOwn(report, key)) continue;
    if (
      !isRecord(report[key]) ||
      Object.values(report[key]).some(
        (entry) => !isRecord(entry) || !severities.has(entry.severity),
      )
    )
      return { blocking: ["invalid-audit-report"] };
  }
  const advisories =
    report && typeof report === "object" && report.advisories
      ? Object.values(report.advisories)
      : [];
  const blocking = [];
  for (const advisory of advisories) {
    if (
      !advisory ||
      typeof advisory !== "object" ||
      !blockingSeverities.has(advisory.severity)
    )
      continue;
    const id = advisory.github_advisory_id;
    if (typeof id !== "string") {
      blocking.push("unknown-high-or-critical-advisory");
      continue;
    }
    blocking.push(id);
  }

  const vulnerabilities =
    report && typeof report === "object" && report.vulnerabilities
      ? Object.values(report.vulnerabilities)
      : [];
  for (const vulnerability of vulnerabilities) {
    if (
      !vulnerability ||
      typeof vulnerability !== "object" ||
      !blockingSeverities.has(vulnerability.severity)
    )
      continue;
    const detail = Array.isArray(vulnerability.via)
      ? vulnerability.via.find((entry) => entry && typeof entry === "object")
      : undefined;
    blocking.push(
      detail?.title ??
        vulnerability.name ??
        "unknown-high-or-critical-advisory",
    );
  }

  return { blocking };
}

function run() {
  const audit = spawnSync("pnpm", ["audit", "--json"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    timeout: 120_000,
  });
  if (audit.error) {
    console.error(`Security audit could not start: ${audit.error.message}`);
    return 1;
  }
  if (audit.status !== 0 && audit.status !== 1) {
    console.error(audit.stderr || "Security audit failed without a report.");
    return 1;
  }

  let report;
  try {
    report = JSON.parse(audit.stdout);
  } catch {
    console.error("Security audit returned an invalid report.");
    return 1;
  }
  if (report?.error) {
    console.error(
      `Security audit response error: ${JSON.stringify(report.error)}`,
    );
    return 1;
  }
  if (!(report?.advisories || report?.vulnerabilities)) {
    console.error(
      "Security audit response did not contain vulnerability data.",
    );
    return 1;
  }
  const result = evaluateAuditReport(report);
  if (result.blocking.length > 0) {
    console.error(
      `Blocking security advisories: ${result.blocking.join(", ")}`,
    );
    return 1;
  }
  if (
    audit.status === 1 &&
    Object.keys(report.advisories ?? {}).length === 0 &&
    Object.keys(report.vulnerabilities ?? {}).length === 0
  ) {
    console.error("Security audit failed without reported findings.");
    return 1;
  }
  console.log("Security audit passed.");
  return 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  process.exitCode = run();
