import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildRelationshipCatalog } from "./relationships.mjs";
import { buildVisualFacts, focusVisualCandidates } from "./visual-facts.mjs";

// JSON-escaped multiline strings become one long line, which OpenCode truncates.
export async function materializeReviewEvidence(
  workspace,
  { relationships = false } = {},
) {
  const indexPath = join(workspace, "pull-request.json");
  let context;
  try {
    context = JSON.parse(await readFile(indexPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  await mkdir(join(workspace, "review-evidence"), { recursive: true });
  let relationshipCatalog = relationships
    ? buildRelationshipCatalog(context)
    : undefined;
  if (relationshipCatalog) {
    relationshipCatalog.facts = buildVisualFacts(context, relationshipCatalog);
    relationshipCatalog = focusVisualCandidates(relationshipCatalog);
    while (
      Buffer.byteLength(JSON.stringify(relationshipCatalog)) > 255 * 1024 &&
      relationshipCatalog.facts.length
    )
      relationshipCatalog.facts.pop();
    context.relationshipCatalogFile = "review-relationships.json";
    context.relationshipFormat = relationshipCatalog.version;
    await writeFile(
      join(workspace, context.relationshipCatalogFile),
      `${JSON.stringify(relationshipCatalog, null, 2)}\n`,
    );
  }
  const inventory = {
    version: "frozen-evidence-v1",
    files: [],
    omissions: context.omissions ?? [],
  };
  context.files = await Promise.all(
    context.files.map(
      async ({ patch, content, baseContent, ...file }, index) => {
        const references = {};
        for (const [kind, text] of Object.entries({
          patch,
          content,
          baseContent,
        })) {
          if (typeof text !== "string") continue;
          const path = `review-evidence/${index}-${kind}.txt`;
          await writeFile(join(workspace, path), text);
          references[`${kind}File`] = path;
          const sha =
            kind === "baseContent" || file.status === "removed"
              ? (file.baseSha ?? context.identity?.baseSha)
              : context.identity?.headSha;
          inventory.files.push({
            filename: file.filename,
            kind,
            evidencePath: path,
            sha: /^[0-9a-f]{40}$/.test(sha || "") ? sha : null,
            lineCount:
              text === ""
                ? 0
                : text.split("\n").length - (text.endsWith("\n") ? 1 : 0),
          });
        }
        return { ...file, ...references };
      },
    ),
  );
  context.evidenceInventory = inventory;
  if (context.eligibilityFiles)
    context.eligibilityFiles = context.eligibilityFiles.map(
      ({ patch, content, baseContent, ...metadata }) => metadata,
    );
  await writeFile(indexPath, `${JSON.stringify(context, null, 2)}\n`);
  return {
    ...inventory,
    ...(relationshipCatalog ? { relationships: relationshipCatalog } : {}),
  };
}
