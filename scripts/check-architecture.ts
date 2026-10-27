import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd(),
  failures: string[] = [];
const check = (ok: boolean, message: string) => {
  if (!ok) failures.push(message);
};
const read = (file: string) => readFileSync(file, "utf8");
const digest = (file: string) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (["node_modules", ".next", ".next-demo", "dist"].includes(e.name))
      return [];
    const p = path.join(dir, e.name);
    return e.isDirectory()
      ? walk(p)
      : /\.tsx?$/.test(p) && !p.endsWith("next-env.d.ts")
        ? [p]
        : [];
  });
}
const baseline = JSON.parse(
  read(path.join(root, "backend/tests/architecture/baseline.json")),
) as {
  routes: string[];
  css: string;
  schema: string;
  migrations: Record<string, string>;
};
const frontend = path.join(root, "frontend"),
  backend = path.join(root, "backend"),
  fileList = [
    ...walk(frontend),
    ...walk(backend),
    ...walk(path.join(root, "scripts")),
  ];
const graph = new Map<string, string[]>(),
  routes: string[] = [];
function resolve(file: string, spec: string) {
  const base = spec.startsWith("@/")
    ? path.join(frontend, "src", spec.slice(2))
    : spec.startsWith(".")
      ? path.resolve(path.dirname(file), spec)
      : null;
  if (!base) return null;
  const without = base.replace(/\.js$/, ""),
    candidates = [
      base,
      without + ".ts",
      without + ".tsx",
      path.join(without, "index.ts"),
      path.join(without, "index.tsx"),
    ];
  return candidates.find((x) => existsSync(x)) ?? null;
}
for (const file of fileList) {
  const text = read(file),
    sf = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    ),
    rel = path.relative(root, file).replaceAll("\\", "/");
  check(
    (sf as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] })
      .parseDiagnostics.length === 0,
    rel + ": invalid TypeScript syntax",
  );
  for (const item of sf.statements) {
    if (
      !ts.isImportDeclaration(item) ||
      !ts.isStringLiteral(item.moduleSpecifier)
    )
      continue;
    const spec = item.moduleSpecifier.text;
    if (spec.startsWith(".") || spec.startsWith("@/"))
      check(!!resolve(file, spec), rel + ": unresolved local import " + spec);
    if (rel.startsWith("frontend/src/"))
      check(
        !spec.includes("backend") && !spec.includes("@prisma"),
        rel + ": frontend imports backend/database code",
      );
    if (rel.startsWith("frontend/src/shared/"))
      check(
        !spec.includes("/features/"),
        rel + ": shared infrastructure imports a feature",
      );
    if (rel.startsWith("backend/src/"))
      check(
        !spec.includes("frontend"),
        rel + ": runtime backend imports frontend code",
      );
    if (rel.endsWith(".service.ts") || rel.endsWith(".repository.ts"))
      check(
        spec !== "express",
        rel + ": business/database module imports Express",
      );
  }
  if (rel.endsWith(".routes.ts") || rel.endsWith(".controller.ts"))
    check(
      !/\b(?:db|tx)\.(?:\$transaction|user\.|session\.|dQRun\.|dataAsset\.|[a-zA-Z]+\.(?:findMany|findFirst|create|update|delete))/.test(
        text,
      ),
      rel + ": transport module performs database work",
    );
  const runtime = ts.transpileModule(text, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const emitted = ts.createSourceFile(
      file,
      runtime,
      ts.ScriptTarget.Latest,
      true,
    ),
    edges: string[] = [];
  for (const item of emitted.statements) {
    if (
      ts.isImportDeclaration(item) &&
      ts.isStringLiteral(item.moduleSpecifier)
    ) {
      const target = resolve(file, item.moduleSpecifier.text);
      if (target) edges.push(target);
    }
  }
  if (rel.startsWith("frontend/src/") || rel.startsWith("backend/src/"))
    graph.set(file, edges);
  if (rel.startsWith("backend/src/")) {
    function visit(n: ts.Node) {
      if (
        ts.isCallExpression(n) &&
        ts.isPropertyAccessExpression(n.expression) &&
        ["app", "router"].includes(n.expression.expression.getText(sf)) &&
        ["get", "post", "patch", "delete", "put", "use"].includes(
          n.expression.name.text,
        ) &&
        n.arguments[0] &&
        ts.isStringLiteral(n.arguments[0])
      )
        routes.push(
          n.expression.name.text.toUpperCase() + " " + n.arguments[0].text,
        );
      ts.forEachChild(n, visit);
    }
    visit(sf);
  }
}
const visiting = new Set<string>(),
  visited = new Set<string>();
function dfs(file: string, trail: string[]) {
  if (visiting.has(file)) {
    failures.push(
      "Runtime import cycle: " +
        [...trail, file].map((p) => path.relative(root, p)).join(" -> "),
    );
    return;
  }
  if (visited.has(file) || !graph.has(file)) return;
  visiting.add(file);
  for (const child of graph.get(file)!) dfs(child, [...trail, file]);
  visiting.delete(file);
  visited.add(file);
}
for (const file of graph.keys()) dfs(file, []);
try {
  assert.deepEqual(routes.sort(), baseline.routes);
} catch {
  failures.push(
    "API route methods, paths or mount prefixes changed from the pre-refactor baseline.",
  );
}
check(
  digest(path.join(frontend, "app/globals.css")) === baseline.css,
  "Global styling changed during organization.",
);
check(
  digest(path.join(backend, "prisma/schema.prisma")) === baseline.schema,
  "Prisma schema changed during organization.",
);
for (const [name, hash] of Object.entries(baseline.migrations))
  check(
    digest(path.join(backend, "prisma/migrations", name, "migration.sql")) ===
      hash,
    "Historical migration changed: " + name,
  );
for (const file of [
  "frontend/app/page.tsx",
  "frontend/app/[...path]/page.tsx",
  "backend/src/server.ts",
  "docs/project-map.md",
])
  check(
    existsSync(path.join(root, file)),
    "Required entry/document missing: " + file,
  );
const pkg = JSON.parse(read(path.join(root, "package.json")));
check(
  JSON.stringify(pkg.workspaces) === JSON.stringify(["frontend", "backend"]),
  "Root workspaces must be frontend and backend.",
);
check(
  !existsSync(path.join(root, "apps/web")) &&
    !existsSync(path.join(root, "apps/api")),
  "Old application directories remain.",
);
if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else
  console.info(
    "Architecture checks passed: imports, dependency directions, runtime cycles, route contracts, unchanged schema/migrations/CSS and project entries.",
  );
