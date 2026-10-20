import { parse } from "@babel/parser";
import { posix } from "node:path";

const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
const unwrap = (node) =>
  [
    "TSAsExpression",
    "TSTypeAssertion",
    "TSNonNullExpression",
    "ParenthesizedExpression",
  ].includes(node?.type)
    ? unwrap(node.expression)
    : node;
const name = (node) =>
  node?.type === "Identifier"
    ? node.name
    : node?.type === "StringLiteral"
      ? node.value
      : undefined;
const literalName = (node) =>
  node?.type === "StringLiteral" ? node.value : undefined;
const member = (node) =>
  node?.type === "MemberExpression" &&
  !node.computed &&
  node.property.type === "Identifier"
    ? [name(node.object), node.property.name]
    : undefined;
const properties = (node) =>
  node?.type === "ObjectExpression" &&
  node.properties.every(
    (property) =>
      property.type === "ObjectProperty" &&
      !property.computed &&
      name(property.key),
  ) &&
  new Set(node.properties.map((property) => name(property.key))).size ===
    node.properties.length
    ? node.properties
    : [];
const property = (node, key) =>
  properties(node).find((item) => name(item.key) === key)?.value;
const expressionBody = (node) => {
  const body = node?.body;
  return unwrap(
    body?.type === "BlockStatement" &&
      body.body.length === 1 &&
      body.body[0].type === "ReturnStatement"
      ? body.body[0].argument
      : body,
  );
};
function children(node) {
  return Object.entries(node)
    .filter(
      ([key]) =>
        ![
          "loc",
          "comments",
          "tokens",
          "errors",
          "leadingComments",
          "trailingComments",
          "innerComments",
        ].includes(key),
    )
    .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
    .filter(
      (value) =>
        value && typeof value === "object" && typeof value.type === "string",
    );
}
function walk(node, visit, owner) {
  if (!node) return;
  const next = visit(node, owner) ?? owner;
  for (const child of children(node)) walk(child, visit, next);
}
const ref = (file, node) => ({
  file: file.filename,
  sha: file.sha,
  startLine: node.loc.start.line,
  endLine: node.loc.end.line,
});
const sameSet = (a, b) =>
  a.length === b.length && a.every((value) => b.includes(value));

// Parse declarations only. Never import, evaluate, or execute contributor source.
export function buildRelationshipCatalog(context) {
  if (
    !/^[0-9a-f]{40}$/.test(context.identity?.headSha ?? "") ||
    !/^[0-9a-f]{40}$/.test(context.identity?.baseSha ?? "")
  )
    return undefined;
  const catalog = {
    version: "visual-relationships-v1",
    nodes: [],
    relationships: [],
    omissions: [],
  };
  const environments = new Map();
  const addNode = (value) => {
    const node = { id: `n${catalog.nodes.length}`, ...value };
    catalog.nodes.push(node);
    return node;
  };
  const addRelationship = (value) => {
    catalog.relationships.push({
      id: `r${catalog.relationships.length}`,
      ...value,
    });
  };
  for (const file of context.files ?? []) {
    if (typeof file.content !== "string") continue;
    if (
      !/\.[cm]?[jt]sx?$/.test(file.filename) ||
      /(?:^|\/)(?:docs?|tests?|fixtures?)(?:\/|\.)|\.(?:test|spec)\./.test(
        file.filename,
      )
    ) {
      if (/\.sql$/.test(file.filename))
        catalog.omissions.push(
          `${file.filename}: SQL migration declarations are not parsed by this bounded Drizzle analyzer; migration/source agreement requires source assessment.`,
        );
      continue;
    }
    if (Buffer.byteLength(file.content) > 524288) {
      catalog.omissions.push(
        `${file.filename}: relationship source exceeds 512 KiB.`,
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
        ...file,
        sha:
          file.status === "removed"
            ? context.identity.baseSha
            : context.identity.headSha,
        ast,
        imports: new Map(),
        locals: new Map(),
        tables: new Map(),
      };
      for (const statement of ast.program.body) {
        const node =
          statement.type === "ExportNamedDeclaration"
            ? statement.declaration
            : statement;
        if (node?.type === "ImportDeclaration")
          for (const specifier of node.specifiers)
            env.imports.set(specifier.local.name, {
              imported: name(specifier.imported),
              source: node.source.value,
            });
        if (node?.type === "VariableDeclaration")
          for (const declaration of node.declarations)
            if (declaration.id.type === "Identifier")
              env.locals.set(declaration.id.name, unwrap(declaration.init));
        if (node?.type === "FunctionDeclaration" && node.id)
          env.locals.set(node.id.name, node);
      }
      environments.set(file.filename, env);
    } catch {
      catalog.omissions.push(
        `${file.filename}: unsupported or invalid source syntax; no relationships inferred.`,
      );
    }
  }
  const core = (env, symbol, expected) =>
    env.imports.get(symbol)?.source === "drizzle-orm/pg-core" &&
    env.imports.get(symbol)?.imported === expected;
  function column(env, expression, seen = new Set()) {
    const node = unwrap(expression);
    if (node?.type !== "CallExpression") return undefined;
    if (node.callee.type === "MemberExpression" && !node.callee.computed) {
      const result = column(env, node.callee.object, seen);
      if (!result) return undefined;
      const method = name(node.callee.property);
      if (method === "primaryKey") {
        result.primary = true;
        result.nullable = false;
      } else if (method === "notNull") result.nullable = false;
      else if (method === "unique") result.unique = true;
      else if (method === "references") {
        const target = member(expressionBody(node.arguments[0]));
        if (!target?.[0]) return undefined;
        result.references.push({
          target,
          column: result.key,
          source: ref(env, node),
        });
      } else if (
        ![
          "default",
          "defaultNow",
          "defaultRandom",
          "generatedAlwaysAsIdentity",
          "generatedByDefaultAsIdentity",
          "$type",
          "$defaultFn",
          "$onUpdate",
          "$onUpdateFn",
        ].includes(method)
      )
        return undefined;
      return result;
    }
    if (node.callee.type !== "Identifier") return undefined;
    const symbol = node.callee.name;
    const primitive = env.imports.get(symbol);
    if (
      primitive?.source === "drizzle-orm/pg-core" &&
      [
        "bigint",
        "integer",
        "smallint",
        "serial",
        "bigserial",
        "smallserial",
        "text",
        "varchar",
        "char",
        "uuid",
        "boolean",
        "numeric",
        "decimal",
        "real",
        "doublePrecision",
        "date",
        "timestamp",
        "json",
        "jsonb",
      ].includes(primitive.imported)
    ) {
      const physical = literalName(node.arguments[0]);
      if (!identifier.test(physical ?? "")) return undefined;
      return {
        name: physical,
        type: primitive.imported,
        nullable: !primitive.imported.endsWith("serial"),
        primary: false,
        unique: false,
        references: [],
      };
    }
    const helper = env.locals.get(symbol);
    if (
      node.arguments.length ||
      seen.has(symbol) ||
      seen.size >= 8 ||
      !["ArrowFunctionExpression", "FunctionDeclaration"].includes(helper?.type)
    )
      return undefined;
    return column(env, expressionBody(helper), new Set([...seen, symbol]));
  }
  function fields(env, object, seen = new Set()) {
    if (object?.type !== "ObjectExpression") return undefined;
    const result = [];
    for (const item of object.properties) {
      if (
        item.type === "SpreadElement" &&
        item.argument.type === "Identifier" &&
        !seen.has(item.argument.name) &&
        seen.size < 8
      ) {
        const spread = fields(
          env,
          env.locals.get(item.argument.name),
          new Set([...seen, item.argument.name]),
        );
        if (!spread) return undefined;
        result.push(...spread);
        continue;
      }
      if (item.type !== "ObjectProperty" || item.computed || !name(item.key))
        return undefined;
      const value = column(env, item.value);
      if (!value) {
        catalog.omissions.push(
          `${env.filename}: column ${name(item.key)} has an unsupported declaration; related edges are omitted.`,
        );
        return undefined;
      }
      value.key = name(item.key);
      result.push(value);
    }
    if (new Set(result.map((col) => col.key)).size !== result.length)
      return undefined;
    return result;
  }
  function chain(expression) {
    const calls = [];
    let node = unwrap(expression);
    while (node?.type === "CallExpression") {
      if (node.callee.type === "Identifier") {
        calls.push({ method: node.callee.name, args: node.arguments, node });
        break;
      }
      if (node.callee.type !== "MemberExpression" || node.callee.computed)
        break;
      calls.push({
        method: name(node.callee.property),
        args: node.arguments,
        node,
      });
      node = unwrap(node.callee.object);
    }
    return calls;
  }
  const tableColumns = (array, tableParam) =>
    array?.type === "ArrayExpression" &&
    array.elements.length &&
    array.elements.every((item) => member(item)?.[0] === tableParam)
      ? array.elements.map((item) => member(item)[1])
      : undefined;
  for (const env of environments.values())
    for (const [symbol, init] of env.locals) {
      if (
        init?.type !== "CallExpression" ||
        !core(env, name(init.callee), "pgTable")
      )
        continue;
      const tableName = literalName(init.arguments[0]);
      if (
        !identifier.test(tableName ?? "") ||
        init.arguments[1]?.type !== "ObjectExpression"
      ) {
        catalog.omissions.push(
          `${env.filename}: dynamic table declaration omitted.`,
        );
        continue;
      }
      const columns = fields(env, init.arguments[1]);
      if (!columns) {
        catalog.omissions.push(
          `${env.filename}: ambiguous, dynamic or unsupported table columns omitted with their relationships.`,
        );
        continue;
      }
      const table = addNode({
        kind: "entity",
        name: tableName,
        label: tableName,
        source: ref(env, init),
        columns,
        uniqueKeys: [],
        foreignKeys: [],
      });
      env.tables.set(symbol, table);
      for (const col of columns) {
        if (col.primary || col.unique) table.uniqueKeys.push([col.key]);
        for (const fk of col.references)
          table.foreignKeys.push({
            columns: [col.key],
            targetSymbol: fk.target[0],
            targetColumns: [fk.target[1]],
            source: fk.source,
          });
        delete col.references;
      }
      const callback = init.arguments[2];
      const param = name(callback?.params?.[0]);
      const constraints = expressionBody(callback);
      const uncertain =
        callback &&
        (!name(callback.params?.[0]) ||
          !["ArrayExpression", "ObjectExpression"].includes(
            constraints?.type,
          ) ||
          (constraints.type === "ObjectExpression" &&
            properties(constraints).length !== constraints.properties.length));
      table.uncertainConstraints = Boolean(uncertain);
      if (uncertain)
        catalog.omissions.push(
          `${env.filename}: dynamic constraints prevent relationship cardinality validation.`,
        );
      const entries =
        constraints?.type === "ArrayExpression"
          ? constraints.elements
          : properties(constraints).map((item) => item.value);
      for (const expression of entries) {
        const calls = chain(expression);
        const root = calls.at(-1);
        if (!root) {
          table.uncertainConstraints = true;
          continue;
        }
        if (core(env, root.method, "primaryKey")) {
          const keys = tableColumns(property(root.args[0], "columns"), param);
          if (
            keys &&
            keys.every((key) => columns.some((col) => col.key === key))
          ) {
            table.uniqueKeys.push(keys);
            for (const col of columns.filter((col) => keys.includes(col.key))) {
              col.primary = true;
              col.nullable = false;
            }
          } else table.uncertainConstraints = true;
        } else if (
          (core(env, root.method, "unique") ||
            core(env, root.method, "uniqueIndex")) &&
          !calls.some((call) => call.method === "where")
        ) {
          const on = calls.find((call) => call.method === "on");
          const keys =
            on &&
            tableColumns({ type: "ArrayExpression", elements: on.args }, param);
          if (
            keys &&
            keys.every((key) => columns.some((col) => col.key === key))
          )
            table.uniqueKeys.push(keys);
          else table.uncertainConstraints = true;
        } else if (core(env, root.method, "foreignKey")) {
          const keys = tableColumns(property(root.args[0], "columns"), param);
          const targets = property(
            root.args[0],
            "foreignColumns",
          )?.elements?.map(member);
          if (
            keys &&
            targets?.length === keys.length &&
            targets.every(
              (target) => target?.[0] && target[0] === targets[0][0],
            )
          )
            table.foreignKeys.push({
              columns: keys,
              targetSymbol: targets[0][0],
              targetColumns: targets.map((target) => target[1]),
              source: ref(env, root.node),
            });
        } else if (core(env, root.method, "check"))
          catalog.omissions.push(
            `${env.filename}:${root.node.loc.start.line}: CHECK constraints are not represented by per-FK ER cardinalities; their source expressions require separate assessment.`,
          );
        else if (!core(env, root.method, "index"))
          table.uncertainConstraints = true;
      }
    }
  const targetTable = (env, symbol) => {
    if (env.tables.has(symbol)) return env.tables.get(symbol);
    const imported = env.imports.get(symbol);
    if (!imported?.source.startsWith(".")) return undefined;
    const path = posix.normalize(
      posix.join(posix.dirname(env.filename), imported.source),
    );
    const target = [
      path,
      path.replace(/\.js$/, ".ts"),
      path.replace(/\.js$/, ".tsx"),
    ]
      .map((path) => environments.get(path))
      .find(Boolean);
    return target?.sha === env.sha
      ? target.tables.get(imported.imported)
      : undefined;
  };
  for (const env of environments.values())
    for (const table of env.tables.values())
      for (const fk of table.foreignKeys) {
        const target = targetTable(env, fk.targetSymbol);
        const sourceCols = fk.columns.map((key) =>
          table.columns.find((col) => col.key === key),
        );
        const targetCols =
          target &&
          fk.targetColumns.map((key) =>
            target.columns.find((col) => col.key === key),
          );
        if (
          !target ||
          table.uncertainConstraints ||
          sourceCols.some((col) => !col) ||
          targetCols.some((col) => !col) ||
          !target.uniqueKeys.some((keys) => sameSet(keys, fk.targetColumns))
        ) {
          catalog.omissions.push(
            `${env.filename}:${fk.source.startLine}: FK evidence is unsupported or incomplete (constraints, targets or referenced uniqueness); relationship omitted, not proof of unavailable source.`,
          );
          continue;
        }
        addRelationship({
          kind: "foreign-key",
          from: table.id,
          to: target.id,
          columns: sourceCols.map((col) => col.name),
          targetColumns: targetCols.map((col) => col.name),
          optional: sourceCols.some((col) => col.nullable),
          inverseUnique: table.uniqueKeys.some((keys) =>
            keys.every((key) => fk.columns.includes(key)),
          ),
          source: fk.source,
        });
      }
  for (const env of environments.values()) {
    const expressions = new Map();
    walk(env.ast, (node, owner) => {
      if (node.type === "FunctionDeclaration" && node.id)
        return addNode({
          kind: "code",
          label: `${env.filename}: ${node.id.name}`,
          source: ref(env, node),
        });
      if (node.type === "VariableDeclarator" && node.id.type === "Identifier")
        return addNode({
          kind: "code",
          label: `${env.filename}: ${node.id.name}`,
          source: ref(env, node),
        });
      if (
        !owner ||
        !["CallExpression", "NewExpression"].includes(node.type) ||
        catalog.relationships.length >= 1024
      )
        return;
      const callee = unwrap(node.callee);
      const label =
        callee?.type === "Identifier"
          ? callee.name
          : callee?.type === "MemberExpression" && !callee.computed
            ? env.content.slice(callee.start, callee.end)
            : undefined;
      if (!label || label.length > 120 || /[\r\n]/.test(label)) return;
      if (!expressions.has(label))
        expressions.set(
          label,
          addNode({
            kind: "code",
            label: `${env.filename}: source expression ${label}`,
            source: ref(env, callee),
          }),
        );
      addRelationship({
        kind: "source-call",
        from: owner.id,
        to: expressions.get(label).id,
        source: ref(env, node),
      });
    });
  }
  // Internal parser details stay transient; only the declared graph is exposed to the model.
  for (const node of catalog.nodes) {
    delete node.uniqueKeys;
    delete node.foreignKeys;
    delete node.uncertainConstraints;
  }
  catalog.omissions.push(
    "Relationships describe parsed source declarations/calls, not deployed infrastructure. SQL, triggers, dynamic builders and arbitrary prose require separate source assessment.",
  );
  const originalNodes = catalog.nodes.length;
  const originalEdges = catalog.relationships.length;
  catalog.nodes = catalog.nodes.slice(0, 512);
  catalog.omissions = [...new Set(catalog.omissions)];
  const omittedNotes = Math.max(0, catalog.omissions.length - 128);
  catalog.omissions = catalog.omissions.slice(0, 128);
  if (omittedNotes)
    catalog.omissions.push(
      `${omittedNotes} additional relationship omission details not listed within the catalogue limit.`,
    );
  const filterEdges = () => {
    const ids = new Set(catalog.nodes.map((node) => node.id));
    catalog.relationships = catalog.relationships.filter(
      (edge) => ids.has(edge.from) && ids.has(edge.to),
    );
  };
  filterEdges();
  while (
    Buffer.byteLength(JSON.stringify(catalog)) > 255 * 1024 &&
    catalog.nodes.length
  ) {
    catalog.nodes.pop();
    filterEdges();
  }
  if (
    catalog.nodes.length < originalNodes ||
    catalog.relationships.length < originalEdges
  )
    catalog.omissions.push(
      `Bounded relationship catalogue omitted ${originalNodes - catalog.nodes.length} nodes and ${originalEdges - catalog.relationships.length} relationships.`,
    );
  return catalog;
}

const label = (value) => value.replace(/[\u0000-\u001f<>"&]/g, " ");
export function renderEvidenceVisuals(value, catalog) {
  if (!value || !Array.isArray(value.diagrams))
    throw new TypeError("Evidence visual diagrams required");
  const diagrams = value.diagrams.map((diagram) => {
    if (
      Object.keys(diagram).sort().join() !==
        "kind,nodeIds,relationshipIds,title" ||
      !["architecture", "schema-domain", "schema-er"].includes(diagram.kind) ||
      typeof diagram.title !== "string" ||
      !Array.isArray(diagram.nodeIds) ||
      !diagram.nodeIds.length ||
      diagram.nodeIds.length > 32 ||
      new Set(diagram.nodeIds).size !== diagram.nodeIds.length ||
      !Array.isArray(diagram.relationshipIds) ||
      diagram.relationshipIds.length > 64 ||
      new Set(diagram.relationshipIds).size !== diagram.relationshipIds.length
    )
      throw new TypeError("Invalid evidence diagram selection");
    const nodes = diagram.nodeIds.map((id) =>
      catalog.nodes.find((node) => node.id === id),
    );
    const relationships = diagram.relationshipIds.map((id) =>
      catalog.relationships.find((edge) => edge.id === id),
    );
    if (
      nodes.some((node) => !node) ||
      relationships.some(
        (edge) =>
          !edge ||
          !diagram.nodeIds.includes(edge.from) ||
          !diagram.nodeIds.includes(edge.to),
      )
    )
      throw new TypeError("Diagram contains unmatched relationship evidence");
    const entity = diagram.kind !== "architecture";
    if (
      nodes.some((node) => (node.kind === "entity") !== entity) ||
      relationships.some((edge) => (edge.kind === "foreign-key") !== entity)
    )
      throw new TypeError("Diagram evidence kind mismatch");
    let mermaid;
    if (diagram.kind === "schema-er") {
      if (new Set(nodes.map((node) => node.name)).size !== nodes.length)
        throw new TypeError("Ambiguous entity names");
      const lines = ["erDiagram"];
      for (const node of nodes) {
        const selected = relationships
          .filter((edge) => edge.from === node.id)
          .flatMap((edge) => edge.columns);
        const cols = node.columns.filter(
          (col) => col.primary || selected.includes(col.name),
        );
        lines.push(
          `  ${node.name} {`,
          ...cols.map(
            (col) =>
              `    ${col.type} ${col.name}${col.primary ? " PK" : ""}${selected.includes(col.name) ? (col.primary ? ", FK" : " FK") : ""}`,
          ),
          "  }",
        );
      }
      for (const edge of relationships) {
        const from = nodes.find((node) => node.id === edge.from);
        const to = nodes.find((node) => node.id === edge.to);
        lines.push(
          `  ${to.name} ${edge.optional ? "|o" : "||"}--${edge.inverseUnique ? "o|" : "o{"} ${from.name} : "FK ${edge.columns.join(",")}"`,
        );
      }
      mermaid = lines.join("\n");
    } else {
      mermaid = [
        "flowchart LR",
        ...nodes.map((node) => `  ${node.id}["${label(node.label)}"]`),
        ...relationships.map(
          (edge) =>
            `  ${edge.from} -->|"${edge.kind} ${label(edge.source.file)}:${edge.source.startLine}"| ${edge.to}`,
        ),
      ].join("\n");
    }
    return { kind: diagram.kind, title: diagram.title, mermaid };
  });
  return { ...value, diagrams };
}
