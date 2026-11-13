import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const layouts = ["apps/web/app/layout.tsx", "apps/admin/app/layout.tsx"];
const entries = layouts.concat([
  "apps/web/app/page.tsx",
  "apps/web/app/[...path]/page.tsx",
  "apps/admin/app/page.tsx",
  "apps/admin/app/[...path]/page.tsx",
]);
const relative = (file: string) => path.relative(root, file);
const source = (file: string) => ts.createSourceFile(
  file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true,
  file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
);

function imports(file: ts.SourceFile) {
  return file.statements.filter(ts.isImportDeclaration).filter(
    (node): node is ts.ImportDeclaration & { moduleSpecifier: ts.StringLiteral } =>
      ts.isStringLiteral(node.moduleSpecifier),
  );
}

function dependencies(file: ts.SourceFile): string[] {
  const modules: string[] = [];
  function visit(node: ts.Node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      modules.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) modules.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(file);
  return modules;
}

function resolveImport(from: string, specifier: string): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const base = path.resolve(path.dirname(from), specifier);
  const bases = /\.[cm]?js$/.test(base) ? [base.replace(/\.[cm]?js$/, "")] : [base];
  for (const candidate of bases.flatMap((value) => [
    value, value + ".tsx", value + ".ts", path.join(value, "index.tsx"), path.join(value, "index.ts"),
  ])) {
    if (/\.[cm]?tsx?$/.test(candidate) && existsSync(candidate)) return candidate;
  }
  return undefined;
}

function reachable(start: string[]): Map<string, ts.SourceFile> {
  const files = new Map<string, ts.SourceFile>();
  function visit(file: string) {
    if (files.has(file)) return;
    const ast = source(file);
    files.set(file, ast);
    for (const module of dependencies(ast)) {
      const resolved = resolveImport(file, module);
      if (resolved) visit(resolved);
    }
  }
  start.forEach((file) => visit(path.resolve(root, file)));
  return files;
}

const graph = reachable(entries);
const presentationTags = new Set([
  "div", "span", "button", "input", "select", "textarea", "h1", "h2", "h3", "h4", "h5", "h6",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  "section", "article", "main", "header", "footer", "nav", "aside", "p", "strong", "b", "small",
  "label", "fieldset", "legend", "details", "summary", "ul", "ol", "li", "dl", "dt", "dd", "hr",
]);

test("reachable Web UI uses Astryx layout, typography and controls", () => {
  const violations: string[] = [];
  const uiFiles = [...graph].filter(([file]) => relative(file).startsWith("packages/ui/") && file.endsWith(".tsx"));
  assert.ok(uiFiles.length > 0, "Both Next app entry points must reach the shared UI package");
  for (const [file, ast] of uiFiles) {
    const report = (node: ts.Node, message: string) => {
      const { line } = ast.getLineAndCharacterOfPosition(node.getStart(ast));
      violations.push(`${relative(file)}:${line + 1} ${message}`);
    };
    function visit(node: ts.Node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(ast);
        if (presentationTags.has(tag)) {
          report(node, `<${tag}> has an Astryx equivalent`);
        }
      }
      if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (/(?:^|[\s(:,])#[\da-f]{3,8}\b|\b\d+(?:\.\d+)?px\b|\brgba?\(|\bhsla?\(/i.test(node.text)) {
          report(node, `hardcoded style value ${JSON.stringify(node.text)}`);
        }
      }
      if (ts.isJsxAttribute(node) && node.name.getText(ast) === "style" && node.initializer) {
        function inspectStyle(style: ts.Node) {
          if (ts.isPropertyAssignment(style)) {
            const name = style.name.getText(ast).replace(/["']/g, "");
            const value = style.initializer;
            if (/^(?:color|backgroundColor|border(?:Top|Right|Bottom|Left)?Color|outlineColor|fill|stroke)$/.test(name)
              && ts.isStringLiteralLike(value) && !/var\(--/.test(value.text)
              && !/^(?:transparent|currentColor|inherit|initial|unset|none)$/.test(value.text)) {
              report(style, `hardcoded ${name}; use a theme token`);
            }
            if (/^(?:(?:min|max)?(?:Width|Height)|width|height|(?:margin|padding)(?:Top|Right|Bottom|Left|Inline|Block)?|(?:row|column)?Gap|gap|borderRadius|top|right|bottom|left)$/.test(name)
              && ts.isNumericLiteral(value) && Number(value.text) !== 0) {
              report(style, `numeric ${name} creates a hardcoded pixel length`);
            }
          }
          ts.forEachChild(style, inspectStyle);
        }
        inspectStyle(node.initializer);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  assert.deepEqual(violations, [], "Use Astryx components and design tokens in active UI source");
});

test("both apps share one Astryx theme boundary and only shipped or generated theme styles", () => {
  const renderedImports = layouts.map((layout) => {
    const file = path.resolve(root, layout);
    const ast = graph.get(file)!;
    const rendered = new Set<string>();
    function visit(node: ts.Node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) rendered.add(node.tagName.getText(ast));
      ts.forEachChild(node, visit);
    }
    visit(ast);
    return imports(ast).flatMap((node) => {
      const module = resolveImport(file, node.moduleSpecifier.text);
      const clause = node.importClause;
      if (!module || !clause) return [];
      const bindings = [
        ...(clause.name ? [{ local: clause.name.text, exported: "default" }] : []),
        ...(clause.namedBindings && ts.isNamedImports(clause.namedBindings)
          ? clause.namedBindings.elements.map((binding) => ({ local: binding.name.text, exported: binding.propertyName?.text || binding.name.text }))
          : []),
      ];
      return bindings.filter((binding) => rendered.has(binding.local)).map((binding) => ({ module, exported: binding.exported }));
    });
  });
  const shared = renderedImports[0].filter((candidate) => renderedImports[1].some(
    (other) => candidate.module === other.module && candidate.exported === other.exported,
  ));
  const themeBoundaries = shared.filter(({ module }) => {
    const subtree = [...reachable([relative(module)]).values()];
    return subtree.some((ast) => imports(ast).some((node) => /^@astryxdesign\/core(?:\/theme)?$/.test(node.moduleSpecifier.text)
      && /\bTheme(?:Provider)?\b/.test(node.importClause?.getText(ast) || "")));
  });
  assert.ok(themeBoundaries.length > 0, "Both root layouts must render the same shared Astryx theme provider");

  const styles = [...graph.values()].flatMap((ast) => imports(ast)
    .filter((node) => node.moduleSpecifier.text.endsWith(".css"))
    .map((node) => ({ from: ast.fileName, module: node.moduleSpecifier.text })));
  assert.ok(styles.some(({ module }) => module === "@astryxdesign/core/reset.css"), "Astryx reset must be loaded by the active entry graph");
  assert.ok(styles.some(({ module }) => module === "@astryxdesign/core/astryx.css"), "Astryx component styles must be loaded by the active entry graph");
  const violations: string[] = [];
  for (const { from, module } of styles) {
    if (module.startsWith("@astryxdesign/")) continue;
    const file = path.resolve(path.dirname(from), module);
    const output = /^src\/themes\/([a-z0-9-]+)\/\1\.css$/.exec(relative(file));
    if (!module.startsWith(".") || !output || !existsSync(file)) {
      violations.push(`${relative(from)} imports non-theme CSS ${module}`);
      continue;
    }
    const css = readFileSync(file, "utf8");
    const header = /^\s*\/\*[\s\S]*?\*\//.exec(css)?.[0] || "";
    const declaredSource = /^\s*\*\s*Source:\s*(.+\.ts)\s*$/m.exec(header)?.[1];
    const themeSource = declaredSource ? path.resolve(root, declaredSource) : "";
    if (!header.includes("@generated by `astryx theme build`") || !themeSource
      || path.dirname(themeSource) !== path.dirname(file) || !existsSync(themeSource)) {
      violations.push(`${relative(file)} must have an Astryx compiler header pointing to its existing theme source`);
      continue;
    }
    const ast = source(themeSource);
    const themeFactories = new Set(imports(ast).filter((node) => node.moduleSpecifier.text === "@astryxdesign/core/theme")
      .flatMap((node) => node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
        ? node.importClause.namedBindings.elements.filter((binding) => (binding.propertyName?.text || binding.name.text) === "defineTheme").map((binding) => binding.name.text)
        : []));
    let definesTheme = false;
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && themeFactories.has(node.expression.text)) definesTheme = true;
      ts.forEachChild(node, visit);
    }
    visit(ast);
    if (!definesTheme || !css.includes(`data-astryx-theme="${output[1]}"`)) {
      violations.push(`${relative(file)} must be a scoped output of an Astryx defineTheme source`);
    }
  }
  assert.deepEqual(violations, [], "Only official generated theme CSS may supplement Astryx; legacy global CSS remains forbidden");
});
