import { parse } from "@babel/parser";
import { posix } from "node:path";

// shortcut: follow two static import hops; extend when schema definitions require deeper dependencies.
export async function prepareSchemaContext(prepared, identity, load, limits) {
  const files = prepared.files.filter(
    (f) =>
      /(?:^|\/)(?:schema|drizzle)(?:\/|\.)/.test(f.filename) &&
      /\.[cm]?[jt]s$/.test(f.filename),
  );
  let reads = 0,
    bytes = 0;
  const tried = new Set();
  const queue = files.map((file) => ({ file, depth: 0 }));
  for (const { file, depth } of queue) {
    if (depth >= 2) continue;
    let ast;
    try {
      ast = parse(file.content, {
        sourceType: "unambiguous",
        plugins: ["typescript"],
      });
    } catch {
      continue;
    }
    for (const node of ast.program.body) {
      if (
        node.type !== "ImportDeclaration" ||
        node.importKind === "type" ||
        !node.source.value.startsWith(".")
      )
        continue;
      const target = posix.normalize(
        posix.join(posix.dirname(file.filename), node.source.value),
      );
      if (target.startsWith("/") || target.split("/").includes("..")) continue;
      const paths = [
        target,
        target.replace(/\.js$/, ".ts"),
        target + ".ts",
        target + "/index.ts",
      ];
      if (prepared.files.some((f) => paths.includes(f.filename))) continue;
      for (const path of new Set(paths)) {
        if (tried.has(path)) continue;
        tried.add(path);
        if (
          reads++ >= 64 ||
          prepared.files.length >= limits.maxFiles ||
          bytes >= limits.maxBytes
        ) {
          prepared.omissions.push(
            "Schema context evidence limit reached; unresolved declarations remain unsupported.",
          );
          return;
        }
        const value = await load(
          path,
          file.evidenceSha ??
            (file.status === "removed" ? identity.baseSha : identity.headSha),
        );
        if (!value) continue;
        const size = Buffer.byteLength(value.content);
        if (size > limits.maxFileBytes || bytes + size > limits.maxBytes) {
          prepared.omissions.push(
            `${path}: schema context byte limit reached.`,
          );
          break;
        }
        bytes += size;
        const added = {
          ...value,
          status: "context",
          evidenceSha:
            file.evidenceSha ??
            (file.status === "removed" ? identity.baseSha : identity.headSha),
        };
        prepared.files.push(added);
        queue.push({ file: added, depth: depth + 1 });
        break;
      }
    }
  }
}
