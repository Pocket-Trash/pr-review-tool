import { JSDOM } from "jsdom";
import { validateVisualPhase } from "./review.mjs";

// Mermaid's label parser initializes DOMPurify from window at module load.
const previousWindow = globalThis.window;
globalThis.window = new JSDOM("").window;
let mermaid;
try {
  ({ default: mermaid } = await import("mermaid"));
} finally {
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
}

const infrastructurePattern =
  /(?:^|\/)(?:railway\.(?:json|toml|ya?ml)|dockerfile(?:\.[^/]*)?|docker-compose[^/]*|wrangler\.toml|pulumi\.[^/]+|(?:terraform|infra|infrastructure|k8s|kubernetes|helm)\/)|^\.github\/workflows\/(?:deploy|release|infrastructure)[^/]*\.ya?ml$/i;
const architectureSourcePattern =
  /(?:^|\/)(?:packages?\/queue|apps?\/workers?|services?\/workers?)(?:\/|$)/i;
const schemaPattern =
  /(?:^|\/)(?:schema|migrations?|drizzle)(?:\/|\.)|(?:^|\/)(?:migrations?|drizzle)\/.*\.sql$/i;
const nonSourcePattern =
  /(?:^|\/)(?:test|tests|fixtures?|docs?)(?:\/|\.)|\.(?:test|spec)\.[^/]+$/i;

export function visualRequirements(files, visualPhase = 1) {
  validateVisualPhase(visualPhase);
  const architecture =
    files.some(({ filename }) => infrastructurePattern.test(filename)) ||
    files
      .filter(
        ({ filename }) =>
          architectureSourcePattern.test(filename) &&
          !nonSourcePattern.test(filename),
      )
      .reduce(
        (total, file) => total + (file.additions || 0) + (file.deletions || 0),
        0,
      ) >= 50;
  const schemaFiles = files.filter(
    ({ filename }) =>
      schemaPattern.test(filename) && !nonSourcePattern.test(filename),
  );
  const schemaLines = schemaFiles.reduce(
    (total, file) => total + (file.additions || 0) + (file.deletions || 0),
    0,
  );
  const changedSourceLines =
    visualPhase === 2
      ? files
          .filter(
            ({ filename }) =>
              !nonSourcePattern.test(filename) &&
              /\.(?:[cm]?[jt]sx?|py|go|rs|java|rb)$/.test(filename),
          )
          .flatMap(({ patch }) =>
            String(patch || "")
              .split("\n")
              .filter(
                (line) =>
                  /^[+-](?![+-])/.test(line) &&
                  !/^[+-]\s*(?:\/\/|#|\/\*|\*)/.test(line),
              ),
          )
      : [];
  return {
    ...(visualPhase === 2
      ? {
          sequence: changedSourceLines.some((line) =>
            /\b(?:await|enqueue|publish|dispatch|emit|fetch|send)\b/.test(line),
          ),
          state: changedSourceLines.some((line) =>
            /\b(?:state|status)\s*(?:=|:)|\b(?:setState|setStatus|transition)\s*\(/.test(
              line,
            ),
          ),
        }
      : {}),
    architecture,
    schema:
      schemaFiles.length === 0
        ? "none"
        : schemaFiles.length >= 3 || schemaLines >= 500
          ? "large"
          : "small",
  };
}

export function visualPrompt(requirements) {
  const requests = [];
  if (requirements.architecture)
    requests.push(
      "one change-focused architecture flowchart covering affected components, connections, and retained or staged paths",
    );
  if (requirements.schema === "small")
    requests.push(
      "one focused schema-er erDiagram covering changed entities and direct relationships",
    );
  if (requirements.schema === "large")
    requests.push(
      "one schema-domain flowchart plus at least one focused schema-er erDiagram; a second ER slice is allowed only for a separate high-risk domain; list omitted tables or relationships under coverageGaps",
    );
  if (requirements.sequence)
    requests.push(
      "one focused sequence sequenceDiagram only when source establishes participants and call/message ordering; label participants with source symbols and messages with file/line anchors, distinguish awaited ordering from concurrent work, and omit invented or unverified runtime steps with coverageGaps instead",
    );
  if (requirements.state)
    requests.push(
      "one focused state stateDiagram-v2 only for source-defined states, transitions and guards; label transitions with source file/line anchors, do not invent retries, terminal states or concurrency guarantees, and disclose inferred/unverified transitions in coverageGaps rather than drawing them as established facts",
    );
  const syntaxes = ["flowchart", "erDiagram"];
  if (requirements.sequence) syntaxes.push("sequenceDiagram");
  if (requirements.state) syntaxes.push("stateDiagram-v2");
  const syntaxList =
    syntaxes.length === 2 ? "flowchart and erDiagram" : syntaxes.join(", ");
  return requests.length
    ? `Conditional visuals requested: ${requests.join("; ")}. Return at most four diagrams. Use only ${syntaxList} with plain-text labels. Do not include raw HTML, click directives, initialization directives, or external links.`
    : "No architecture, infrastructure, or schema visual is requested; return no diagrams.";
}

export function visualSkipReason(requirements) {
  return !requirements.architecture &&
    requirements.schema === "none" &&
    !requirements.sequence &&
    !requirements.state
    ? "No eligible architecture, domain, or ERD changes; inference was skipped."
    : null;
}

function permitted(kind, requirements) {
  if (!requirements) return true;
  if (kind === "architecture") return requirements.architecture;
  if (kind === "schema-domain") return requirements.schema === "large";
  if (kind === "schema-er") return requirements.schema !== "none";
  if (kind === "sequence") return requirements.sequence === true;
  if (kind === "state") return requirements.state === true;
  return false;
}

function unsafeReason(source) {
  if (/(?:^|[;\n])\s*(?:links?|properties)\b/im.test(source))
    return "interactive directive";
  if (/(?:^|[;\n])\s*click\b/im.test(source)) return "click directive";
  if (/%%\s*\{/i.test(source)) return "initialization directive";
  if (/<\/?[a-z][^>]*>/i.test(source)) return "raw HTML";
  if (
    /\b(?:https?|ftp|mailto|javascript|data):/i.test(source) ||
    /(?:^|[\s"'(])\/\/[\w.-]+\.[a-z]{2,}/im.test(source)
  )
    return "external link";
  return null;
}

export async function sanitizeVisuals(
  review,
  requirements,
  parse = (source) => mermaid.parse(source, { suppressErrors: true }),
) {
  const diagrams = [];
  const valid = [];
  const coverageGaps = [...review.coverageGaps];
  for (const diagram of review.diagrams) {
    if (!permitted(diagram.kind, requirements)) {
      coverageGaps.push(
        `Omitted ${diagram.title}: ${diagram.kind} was not eligible for this change.`,
      );
      continue;
    }
    const reason = unsafeReason(diagram.mermaid);
    if (reason) {
      coverageGaps.push(`Omitted ${diagram.title}: unsafe Mermaid ${reason}.`);
      continue;
    }
    const expected =
      diagram.kind === "state"
        ? "stateDiagram"
        : diagram.kind === "sequence"
          ? "sequence"
          : diagram.kind === "schema-er"
            ? "er"
            : "flowchart-v2";
    try {
      const parsed = await parse(diagram.mermaid);
      if (!parsed || parsed.diagramType !== expected)
        throw new Error(`expected ${expected}`);
      valid.push(diagram);
    } catch {
      coverageGaps.push(`Omitted ${diagram.title}: invalid Mermaid syntax.`);
    }
  }

  const limits = {
    architecture: 1,
    "schema-domain": 1,
    "schema-er": requirements?.schema === "small" ? 1 : 2,
    sequence: 1,
    state: 1,
  };
  const priority = [];
  if (requirements?.architecture) priority.push("architecture");
  if (requirements?.schema === "large") priority.push("schema-domain");
  if (requirements?.schema !== "none") priority.push("schema-er");
  for (const kind of [
    "architecture",
    "schema-domain",
    "schema-er",
    "sequence",
    "state",
  ])
    if (!priority.includes(kind)) priority.push(kind);
  for (const kind of priority) {
    for (const diagram of valid.filter(
      (candidate) => candidate.kind === kind,
    )) {
      if (diagrams.length >= 4) break;
      if (
        diagrams.filter((candidate) => candidate.kind === kind).length >=
        limits[kind]
      )
        continue;
      diagrams.push(diagram);
    }
  }
  if (valid.length > diagrams.length)
    coverageGaps.push(
      `Diagram cap or visual-scope limit reached; omitted ${valid.length - diagrams.length} diagram(s).`,
    );

  if (
    requirements?.architecture &&
    !diagrams.some(({ kind }) => kind === "architecture")
  )
    coverageGaps.push(
      "Architecture change had no valid architecture flowchart.",
    );
  if (
    requirements?.schema === "small" &&
    !diagrams.some(({ kind }) => kind === "schema-er")
  )
    coverageGaps.push("Schema change had no valid focused ER diagram.");
  if (requirements?.schema === "large") {
    if (!diagrams.some(({ kind }) => kind === "schema-domain"))
      coverageGaps.push("Large schema change had no valid domain map.");
    if (!diagrams.some(({ kind }) => kind === "schema-er"))
      coverageGaps.push("Large schema change had no valid focused ER slice.");
  }
  if (
    requirements?.sequence &&
    !diagrams.some(({ kind }) => kind === "sequence")
  )
    coverageGaps.push(
      "Interaction change had no valid source-grounded sequence diagram.",
    );
  if (requirements?.state && !diagrams.some(({ kind }) => kind === "state"))
    coverageGaps.push(
      "State change had no valid source-grounded state diagram.",
    );
  return { ...review, diagrams, coverageGaps: [...new Set(coverageGaps)] };
}
