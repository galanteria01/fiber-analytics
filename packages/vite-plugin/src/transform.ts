import { transformSync, type PluginObj, type NodePath, types as t } from '@babel/core';
import path from 'node:path';
import {
  COMP_ATTR,
  PROPS_ATTR,
  LOC_ATTR,
  IGNORE_ATTR,
  INTERACTIVE_TAGS,
  INTERACTIVE_HANDLERS,
  isSensitiveKey,
  type PrimitiveValue,
} from '@fiber-analytics/core';

const TS_EXTENSIONS = /\.tsx?$/;

export interface TransformOptions {
  /** Extra native tags to treat as interactive (merged with defaults). */
  interactiveTags?: string[];
  /** Extra handler prop names that mark an element interactive (merged). */
  interactiveHandlers?: string[];
  /** Inject `data-fa-loc` (`file:line:col`) for trace-to-source. Default false. */
  includeSourceLocation?: boolean;
  /** Project root used to relativize source-location paths. */
  rootDir?: string;
  /** Additional prop names to never capture (merged with the core denylist). */
  propDenylist?: string[];
}

interface ResolvedOptions {
  tags: Set<string>;
  handlers: Set<string>;
  includeSourceLocation: boolean;
  rootDir: string;
  denylist: Set<string>;
}

function resolveOptions(options: TransformOptions): ResolvedOptions {
  return {
    tags: new Set([...INTERACTIVE_TAGS, ...(options.interactiveTags ?? [])]),
    handlers: new Set([...INTERACTIVE_HANDLERS, ...(options.interactiveHandlers ?? [])]),
    includeSourceLocation: options.includeSourceLocation ?? false,
    rootDir: options.rootDir ?? process.cwd(),
    denylist: new Set((options.propDenylist ?? []).map((k) => k.toLowerCase())),
  };
}

function pascalFromFile(filename: string): string {
  const base = path.basename(filename).replace(/\.[jt]sx?$/, '');
  if (!base || base === 'index') return 'Anonymous';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Resolves a component name for the nearest enclosing function, handling
 * `function Foo()`, `const Foo = () => {}`, `memo`/`forwardRef` wrappers, and
 * `Foo.displayName = ...` assignments. Falls back through outer functions, then
 * to a PascalCase of the filename for anonymous `export default` components.
 */
function nameFromFunction(fnPath: NodePath): string | null {
  const fnNode = fnPath.node;
  if ((t.isFunctionDeclaration(fnNode) || t.isFunctionExpression(fnNode)) && fnNode.id) {
    return fnNode.id.name;
  }

  let p: NodePath | null = fnPath.parentPath;
  while (p) {
    const n = p.node;
    if (t.isVariableDeclarator(n) && t.isIdentifier(n.id)) return n.id.name;
    if (t.isFunctionDeclaration(n) && n.id) return n.id.name;
    if (t.isAssignmentExpression(n) && t.isIdentifier(n.left)) return n.left.name;
    // Unwrap memo()/forwardRef() and similar HOC call wrappers.
    if (t.isCallExpression(n) || t.isVariableDeclaration(n)) {
      p = p.parentPath;
      continue;
    }
    if (t.isFunction(n)) break;
    p = p.parentPath;
  }
  return null;
}

function resolveComponentName(path: NodePath, filename: string): string {
  let fnPath = path.getFunctionParent();
  while (fnPath) {
    const name = nameFromFunction(fnPath);
    if (name) return name;
    fnPath = fnPath.getFunctionParent();
  }
  return pascalFromFile(filename);
}

function nativeTagName(opening: t.JSXOpeningElement): string | null {
  const name = opening.name;
  if (t.isJSXIdentifier(name)) {
    const tag = name.name;
    if (tag[0] && tag[0] === tag[0].toLowerCase()) return tag;
  }
  return null;
}

function attributeName(attr: t.JSXAttribute): string | null {
  return t.isJSXIdentifier(attr.name) ? attr.name.name : null;
}

function hasAttribute(opening: t.JSXOpeningElement, attrName: string): boolean {
  return opening.attributes.some(
    (attr) => t.isJSXAttribute(attr) && attributeName(attr) === attrName,
  );
}

function isInteractive(opening: t.JSXOpeningElement, opts: ResolvedOptions): boolean {
  const tag = nativeTagName(opening);
  if (tag && opts.tags.has(tag)) return true;

  for (const attr of opening.attributes) {
    if (!t.isJSXAttribute(attr)) continue;
    const name = attributeName(attr);
    if (name && opts.handlers.has(name)) return true;
    // role="button" / role="link" are interactive ARIA widgets.
    if (name === 'role' && t.isStringLiteral(attr.value)) {
      if (attr.value.value === 'button' || attr.value.value === 'link') return true;
    }
  }
  return false;
}

function staticPrimitive(attr: t.JSXAttribute): PrimitiveValue | undefined {
  const value = attr.value;
  if (value === null || value === undefined) return true;
  if (t.isStringLiteral(value)) return value.value;
  if (t.isJSXExpressionContainer(value)) {
    const expr = value.expression;
    if (t.isStringLiteral(expr)) return expr.value;
    if (t.isNumericLiteral(expr)) return expr.value;
    if (t.isBooleanLiteral(expr)) return expr.value;
    if (t.isNullLiteral(expr)) return null;
  }
  return undefined;
}

function collectProps(
  opening: t.JSXOpeningElement,
  opts: ResolvedOptions,
): Record<string, PrimitiveValue> {
  const props: Record<string, PrimitiveValue> = {};
  for (const attr of opening.attributes) {
    if (!t.isJSXAttribute(attr)) continue;
    const name = attributeName(attr);
    if (!name) continue;
    if (name === COMP_ATTR || name === PROPS_ATTR || name === LOC_ATTR || name === IGNORE_ATTR) {
      continue;
    }
    if (opts.handlers.has(name) || /^on[A-Z]/.test(name)) continue;
    if (isSensitiveKey(name) || opts.denylist.has(name.toLowerCase())) continue;
    const value = staticPrimitive(attr);
    if (value !== undefined) props[name] = value;
  }
  return props;
}

function sourceLocation(
  opening: t.JSXOpeningElement,
  filename: string,
  opts: ResolvedOptions,
): string | null {
  const loc = opening.loc;
  if (!loc) return null;
  const rel = path.relative(opts.rootDir, filename) || path.basename(filename);
  return `${rel}:${loc.start.line}:${loc.start.column + 1}`;
}

function fiberAnalyticsBabelPlugin(filename: string, opts: ResolvedOptions): PluginObj {
  return {
    name: 'fiber-analytics-tagger',
    visitor: {
      JSXOpeningElement(path) {
        const opening = path.node;
        if (hasAttribute(opening, COMP_ATTR)) return;
        if (hasAttribute(opening, IGNORE_ATTR)) return;
        if (!isInteractive(opening, opts)) return;

        const componentName = resolveComponentName(path, filename);
        opening.attributes.push(
          t.jsxAttribute(t.jsxIdentifier(COMP_ATTR), t.stringLiteral(componentName)),
        );

        const props = collectProps(opening, opts);
        if (Object.keys(props).length > 0) {
          // Emit as an expression container (`={"..."}`): the JSON contains
          // double quotes which are invalid in a plain JSX string attribute
          // when re-parsed by the React plugin downstream.
          opening.attributes.push(
            t.jsxAttribute(
              t.jsxIdentifier(PROPS_ATTR),
              t.jsxExpressionContainer(t.stringLiteral(JSON.stringify(props))),
            ),
          );
        }

        if (opts.includeSourceLocation) {
          const loc = sourceLocation(opening, filename, opts);
          if (loc) {
            opening.attributes.push(
              t.jsxAttribute(t.jsxIdentifier(LOC_ATTR), t.stringLiteral(loc)),
            );
          }
        }
      },
    },
  };
}

/**
 * Minimal raw source map shape, structurally compatible with what Vite /
 * Rollup expect from a plugin `transform` hook.
 */
export interface RawSourceMap {
  version: number;
  sources: string[];
  names: string[];
  mappings: string;
  file?: string;
  sourcesContent?: string[];
}

export interface TransformResult {
  code: string;
  map: RawSourceMap | null;
}

/**
 * Transforms a single source module, injecting `data-fa-*` attributes onto
 * interactive JSX. Returns `null` when there is nothing to transform.
 */
export function transformSource(
  code: string,
  filename: string,
  options: TransformOptions = {},
): TransformResult | null {
  const opts = resolveOptions(options);
  const isTs = TS_EXTENSIONS.test(filename);
  const parserPlugins = isTs ? ['jsx' as const, 'typescript' as const] : ['jsx' as const];

  const result = transformSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    sourceMaps: true,
    parserOpts: { plugins: parserPlugins },
    plugins: [fiberAnalyticsBabelPlugin(filename, opts)],
  });

  if (!result || result.code == null) return null;
  return { code: result.code, map: (result.map as unknown as RawSourceMap) ?? null };
}
