import { parse } from "@babel/parser";
import { posix } from "node:path";

const sourceFile = (f) =>
  /\.[cm]?[jt]sx?$/.test(f.filename) &&
  !/(?:^|\/)(?:tests?|fixtures?|docs?)(?:\/|\.)|\.(?:test|spec|stories)\./.test(
    f.filename,
  );
const walk = (node, visit, owner) => {
  if (!node || typeof node !== "object") return;
  const next = visit(node, owner) ?? owner;
  for (const [key, value] of Object.entries(node)) {
    if (
      [
        "loc",
        "comments",
        "leadingComments",
        "trailingComments",
        "innerComments",
      ].includes(key)
    )
      continue;
    for (const child of Array.isArray(value) ? value : [value])
      if (child?.type) walk(child, visit, next);
  }
};
const text = (env, node) => env.file.content.slice(node.start, node.end);
const key = (node) => node?.name ?? node?.value;
const property = (node, name) =>
  node?.properties?.find((p) => key(p.key) === name && !p.computed)?.value;

// Only static, supplied modules participate; source is parsed, never executed.
export function applicationArchitecture(files) {
  const envs = new Map(),
    omissions = [],
    nodes = [],
    relationships = [];
  let uncertain = false;
  for (const file of files.filter(sourceFile)) {
    if (typeof file.content !== "string") {
      uncertain = true;
      omissions.push(
        `${file.filename}: application structure source unavailable.`,
      );
      continue;
    }
    try {
      const ast = parse(file.content, {
        sourceType: "unambiguous",
        plugins: [
          "typescript",
          ...(file.filename.endsWith("x") ? ["jsx"] : []),
        ],
      });
      const env = {
        file,
        ast,
        imports: new Map(),
        symbols: new Map(),
        routes: [],
        contexts: [],
        providers: [],
        accesses: [],
        calls: [],
        shadowed: new Set(),
        resolved: new Map(),
      };
      envs.set(file.filename, env);
      for (const s of ast.program.body) {
        const n = s.type === "ExportNamedDeclaration" ? s.declaration : s;
        if (n?.type === "ImportDeclaration" && n.importKind !== "type")
          for (const spec of n.specifiers)
            if (spec.importKind !== "type")
              env.imports.set(spec.local.name, {
                source: n.source.value,
                name: key(spec.imported) ?? "default",
                node: n,
              });
      }
      walk(ast.program, (n) => {
        if (n.params)
          for (const parameter of n.params)
            walk(parameter, (b) => {
              if (b.type === "Identifier") env.shadowed.add(b.name);
            });
        if (n.type === "CatchClause" && n.param?.name)
          env.shadowed.add(n.param.name);
      });
      walk(ast.program, (n, owner) => {
        if (
          (n.type === "FunctionDeclaration" ||
            n.type === "VariableDeclarator") &&
          n.id?.type === "Identifier"
        ) {
          const symbol = { env, node: n, name: n.id.name, owner };
          const previous = env.symbols.get(symbol.name);
          env.symbols.set(symbol.name, previous ? null : symbol);
          return symbol;
        }
      });
      const react = (callee, method) =>
        !env.shadowed.has(callee?.name ?? callee?.object?.name) &&
        !env.symbols.has(callee?.name ?? callee?.object?.name) &&
        (callee?.type === "Identifier"
          ? env.imports.get(callee.name)?.source === "react" &&
            env.imports.get(callee.name)?.name === method
          : callee?.type === "MemberExpression" &&
            !callee.computed &&
            callee.property.name === method &&
            env.imports.get(callee.object.name)?.source === "react");
      walk(ast.program, (n, owner) => {
        if (
          (n.type === "FunctionDeclaration" ||
            n.type === "VariableDeclarator") &&
          n.id?.type === "Identifier"
        )
          return env.symbols.get(n.id.name) ?? owner;
        if (!owner) return;
        if (n.type === "CallExpression") {
          env.calls.push({ node: n, owner });
          if (react(n.callee, "createContext"))
            env.contexts.push({ owner, node: n });
          if (
            react(n.callee, "useContext") &&
            n.arguments[0]?.type === "Identifier"
          )
            env.accesses.push({
              owner:
                [...env.symbols.values()]
                  .filter(
                    (s) =>
                      s &&
                      (s.node.type === "FunctionDeclaration" ||
                        [
                          "ArrowFunctionExpression",
                          "FunctionExpression",
                        ].includes(s.node.init?.type)) &&
                      s.node.start <= n.start &&
                      s.node.end >= n.end,
                  )
                  .sort(
                    (a, b) =>
                      a.node.end - a.node.start - (b.node.end - b.node.start),
                  )[0] ?? owner,
              node: n,
              name: n.arguments[0].name,
            });
          const factory =
            n.callee?.type === "CallExpression" ? n.callee.callee : null;
          const imported =
            factory?.type === "Identifier" && env.imports.get(factory.name);
          if (
            !env.shadowed.has(factory?.name) &&
            !env.symbols.has(factory?.name) &&
            imported?.source === "@tanstack/react-router" &&
            imported.name === "createFileRoute" &&
            property(n.arguments[0], "loader")
          )
            env.routes.push({
              owner,
              node: n,
              loader: property(n.arguments[0], "loader"),
            });
        }
        if (
          n.type === "JSXOpeningElement" &&
          n.name.type === "JSXMemberExpression" &&
          n.name.property.name === "Provider" &&
          n.name.object.type === "JSXIdentifier" &&
          n.attributes.some((a) => a.name?.name === "value")
        )
          env.providers.push({ owner, node: n, name: n.name.object.name });
      });
    } catch {
      uncertain = true;
      omissions.push(
        `${file.filename}: application structure syntax unsupported.`,
      );
    }
  }
  const resolve = (env, name) => {
    if (env.shadowed.has(name)) return;
    if (env.resolved.has(name)) return env.resolved.get(name);
    const result = resolveUncached(env, name);
    env.resolved.set(name, result);
    return result;
  };
  const resolveUncached = (env, name) => {
    // shortcut: ambiguous module-wide bindings are omitted; add lexical scopes when broader syntax is needed.
    if (env.symbols.has(name)) {
      const symbol = env.symbols.get(name);
      return symbol?.owner ? undefined : symbol;
    }
    const imported = env.imports.get(name);
    if (!imported) return;
    let target;
    if (imported.source.startsWith("."))
      target = posix.normalize(
        posix.join(posix.dirname(env.file.filename), imported.source),
      );
    else
      for (const [prefix, directory] of Object.entries(
        env.file.applicationAliases ?? {},
      ))
        if (imported.source.startsWith(prefix))
          target = directory + imported.source.slice(prefix.length);
    if (!target || target.startsWith("/") || target.split("/").includes(".."))
      return;
    const matches = [...envs.keys()].filter(
      (p) =>
        p === target ||
        [
          ".ts",
          ".tsx",
          ".js",
          ".jsx",
          ".mjs",
          "/index.ts",
          "/index.tsx",
          "/index.js",
        ].some((ext) => p === target + ext),
    );
    if (matches.length !== 1 || envs.get(matches[0]).file.status === "removed")
      return;
    const symbol = envs.get(matches[0]).symbols.get(imported.name);
    if (symbol?.owner) return;
    const declaration = envs
      .get(matches[0])
      .ast.program.body.find(
        (s) =>
          s.type === "ExportNamedDeclaration" &&
          (s.declaration?.id?.name === imported.name ||
            s.declaration?.declarations?.some(
              (d) => d.id?.name === imported.name,
            )),
      );
    return declaration ? symbol : undefined;
  };
  const ids = new Map();
  const add = (symbol) => {
    if (ids.has(symbol)) return ids.get(symbol);
    const id = `a${nodes.length}`;
    ids.set(symbol, id);
    nodes.push({
      id,
      kind: "code",
      label: `${symbol.env.file.filename}: ${symbol.name}`,
      source: {
        file: symbol.env.file.filename,
        sha:
          symbol.env.file.status === "removed"
            ? symbol.env.file.baseSha
            : symbol.env.file.headSha,
        startLine: symbol.node.loc.start.line,
        endLine: symbol.node.loc.end.line,
      },
    });
    return id;
  };
  const edge = (from, to, env, node, label) =>
    relationships.length < 128 &&
    relationships.push({
      kind: "source-binding",
      from: add(from),
      to: add(to),
      label,
      source: {
        file: env.file.filename,
        sha: env.file.headSha,
        startLine: node.loc.start.line,
        endLine: node.loc.end.line,
      },
    });
  const changed = (env, node) => {
    if (["unchanged", "context"].includes(env.file.status)) return false;
    if (typeof env.file.baseContent !== "string") {
      uncertain = true;
      omissions.push(
        `${env.file.filename}: application comparison baseline unavailable.`,
      );
      return false;
    }
    return !env.file.baseContent.includes(text(env, node));
  };
  let eligible = false;
  for (const env of envs.values())
    for (const route of env.routes) {
      if (!changed(env, route.loader)) continue;
      const before = relationships.length;
      const shadowed = new Set();
      walk(route.loader, (node) => {
        for (const parameter of node.params ?? [])
          walk(parameter, (binding) => {
            if (binding.type === "Identifier") shadowed.add(binding.name);
          });
        if (node.type === "VariableDeclarator" && node.id?.name)
          shadowed.add(node.id.name);
      });
      walk(route.loader, (n) => {
        if (
          relationships.length >= 128 ||
          n.type !== "CallExpression" ||
          n.callee.type !== "Identifier"
        )
          return;
        const target =
          !shadowed.has(n.callee.name) && resolve(env, n.callee.name);
        if (target) edge(route.owner, target, env, n, "loader calls");
      });
      if (route.loader.type === "Identifier") {
        const target = resolve(env, route.loader.name);
        if (target)
          edge(route.owner, target, env, route.loader, "loader registered");
      }
      if (relationships.length > before) eligible = true;
      else {
        uncertain = true;
        omissions.push(
          `${env.file.filename}: changed loader has no resolved source target.`,
        );
      }
    }
  for (const env of envs.values())
    for (const context of env.contexts) {
      const providers = [],
        consumers = [];
      for (const candidate of envs.values()) {
        for (const p of candidate.providers)
          if (resolve(candidate, p.name) === context.owner)
            providers.push({ ...p, env: candidate });
        for (const a of candidate.accesses)
          if (resolve(candidate, a.name) === context.owner) {
            consumers.push({ ...a, env: candidate });
            for (const other of envs.values())
              for (const call of other.calls) {
                const n = call.node;
                if (
                  n.callee.type === "Identifier" &&
                  resolve(other, n.callee.name) === a.owner
                )
                  consumers.push({ owner: call.owner, node: n, env: other });
              }
          }
      }
      const callers = consumers.filter((c) => c.owner);
      const changedStructure =
        changed(env, context.node) ||
        providers.some((p) => changed(p.env, p.node)) ||
        callers.some((c) => changed(c.env, c.node));
      if (
        !changedStructure ||
        !providers.length ||
        new Set(callers.map((c) => c.env.file.filename)).size < 2
      )
        continue;
      eligible = true;
      for (const p of providers)
        edge(p.owner, context.owner, p.env, p.node, "provides context");
      for (const c of callers)
        edge(
          c.owner,
          context.owner,
          c.env,
          c.node,
          "reads context via declared hook",
        );
    }
  return {
    eligible,
    uncertain,
    omissions: [...new Set(omissions)],
    nodes,
    relationships,
  };
}

export async function prepareApplicationContext(
  prepared,
  identity,
  load,
  limits,
) {
  const cache = new Map();
  let requests = 0,
    readBytes = 0;
  const incomplete = (reason) => {
    prepared.applicationIncomplete = true;
    prepared.omissions.push(reason);
  };
  const read = async (path) => {
    if (!cache.has(path)) {
      if (requests++ >= 128) {
        incomplete("Application context request limit reached.");
        return null;
      }
      const value = await load(path);
      const size = Buffer.byteLength(value?.content ?? "");
      if (size > limits.maxFileBytes || readBytes + size > limits.maxBytes) {
        incomplete(`${path}: application context read budget reached.`);
        cache.set(path, null);
      } else {
        readBytes += size;
        cache.set(path, value);
      }
    }
    return cache.get(path);
  };
  let bytes = prepared.files.reduce(
    (n, f) =>
      n +
      Buffer.byteLength(f.content ?? "") +
      Buffer.byteLength(f.baseContent ?? ""),
    0,
  );
  const original = [...prepared.files];
  for (const file of original.filter(sourceFile)) {
    const aliases = {};
    let dir = posix.dirname(file.filename);
    while (true) {
      const config = await read(
        dir === "." ? "tsconfig.json" : `${dir}/tsconfig.json`,
      );
      if (config) {
        try {
          const parsed = JSON.parse(config.content);
          const options = parsed.compilerOptions ?? {};
          if (parsed.extends && !options.paths)
            incomplete(
              `${file.filename}: inherited path aliases are unassessed.`,
            );
          for (const [pattern, targets] of Object.entries(options.paths ?? {}))
            if (
              pattern.endsWith("*") &&
              targets.length === 1 &&
              targets[0].endsWith("*")
            ) {
              const target =
                posix.normalize(
                  posix.join(
                    dir,
                    options.baseUrl ?? ".",
                    targets[0].slice(0, -1).replace(/\/$/, ""),
                  ),
                ) + "/";
              if (!target.startsWith("/") && !target.split("/").includes(".."))
                aliases[pattern.slice(0, -1)] = target;
            }
        } catch {
          incomplete(
            `${file.filename}: static path configuration unsupported.`,
          );
        }
        break;
      }
      if (dir === ".") break;
      dir = posix.dirname(dir);
    }
    file.applicationAliases = aliases;
    let ast;
    try {
      ast = parse(file.content, {
        sourceType: "unambiguous",
        plugins: [
          "typescript",
          ...(file.filename.endsWith("x") ? ["jsx"] : []),
        ],
      });
    } catch {
      continue;
    }
    for (const statement of ast.program.body) {
      if (
        statement.type !== "ImportDeclaration" ||
        statement.importKind === "type"
      )
        continue;
      const spec = statement.source.value;
      let path = spec.startsWith(".")
        ? posix.normalize(posix.join(posix.dirname(file.filename), spec))
        : undefined;
      for (const [prefix, target] of Object.entries(aliases))
        if (spec.startsWith(prefix)) path = target + spec.slice(prefix.length);
      if (!path || path.startsWith("/") || path.split("/").includes(".."))
        continue;
      const paths = [
        path,
        ...[
          ".ts",
          ".tsx",
          ".js",
          ".jsx",
          ".mjs",
          "/index.ts",
          "/index.tsx",
          "/index.js",
        ].map((ext) => path + ext),
      ];
      if (prepared.files.some((f) => paths.includes(f.filename))) continue;
      if (prepared.files.length >= limits.maxFiles) {
        incomplete(`${path}: application context file limit reached.`);
        continue;
      }
      for (const candidate of paths) {
        const loaded = await read(candidate);
        if (!loaded) continue;
        if (bytes + Buffer.byteLength(loaded.content) > limits.maxBytes) {
          incomplete(`${candidate}: application context byte limit reached.`);
          break;
        }
        bytes += Buffer.byteLength(loaded.content);
        prepared.files.push({
          ...loaded,
          status: "context",
          headSha: identity.headSha,
          applicationAliases: aliases,
        });
        break;
      }
    }
  }
}
