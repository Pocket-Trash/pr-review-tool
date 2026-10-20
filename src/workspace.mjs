import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// JSON-escaped multiline strings become one long line, which OpenCode truncates.
export async function materializeReviewEvidence(workspace) {
  const indexPath = join(workspace, "pull-request.json");
  let context;
  try {
    context = JSON.parse(await readFile(indexPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  await mkdir(join(workspace, "review-evidence"), { recursive: true });
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
        }
        return { ...file, ...references };
      },
    ),
  );
  await writeFile(indexPath, `${JSON.stringify(context, null, 2)}\n`);
}
