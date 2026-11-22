import type { PluginObj } from '@babel/core';
import type { NodePath, types as t } from '@babel/core';
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
import { types as babelTypes } from '@babel/core';

// Re-export TransformOptions for babel consumers
export type { TransformOptions } from './transform.js';
import type { TransformOptions } from './transform.js';

export interface BabelPluginOptions extends TransformOptions {
  /** Extra native tags to treat as interactive (merged with defaults). */
  interactiveTags?: string[];
  /** Extra handler prop names that mark an element interactive (merged). */
  interactiveHandlers?: string[];
  /** Inject data-fa-loc for trace-to-source. Default false. */
  includeSourceLocation?: boolean;
  /** Project root for relativizing loc paths. */
  rootDir?: string;
  /** Additional prop names to never capture. */
  propDenylist?: string[];
}

interface ResolvedOptions {
  tags: Set<string>;
  handlers: Set<string>;
  includeSourceLocation: boolean;
  rootDir: string;
  denylist: Set<string>;
}

function resolveOptions(options: BabelPluginOptions): ResolvedOptions {
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

function nameFromFunction(fnPath: NodePath, t: typeof babelTypes): string | null {
  const fnNode = fnPath.node;
  if (
    (t.isFunctionDeclaration(fnNode) || t.isFunctionExpression(fnNode)) &&
    (fnNode as { id?: { name: string } | null }).id
  ) {
    return (fnNode as { id: { name: string } }).id.name;
  }
  let p: NodePath | null = fnPath.parentPath as NodePath | null;
  while (p) {
    const n = p.node as unknown as Record<string, unknown>;
    const id = n.id as { name: string } | undefined;
    const left = (n.left ?? (n as { left?: unknown }).left) as { name: string } | undefined;
    if (n.type === 'VariableDeclarator' && id) return id.name;
    if (n.type === 'FunctionDeclaration' && (n as { id?: { name: string } | null }).id)
      return (n as { id: { name: string } }).id.name;
    if (n.type === 'AssignmentExpression' && left) return left.name;
    if (n.type === 'CallExpression' || n.type === 'VariableDeclaration') {
      p = p.parentPath as NodePath | null;
      continue;
    }
    if (
      [
        'FunctionDeclaration',
        'FunctionExpression',
        'ArrowFunctionExpression',
        'ObjectMethod',
        'ClassMethod',
      ].includes(n.type as string)
    )
      break;
    p = p.parentPath as NodePath | null;
  }
  return null;
}

function resolveComponentName(path: NodePath, filename: string, t: typeof babelTypes): string {
  let fnPath = path.getFunctionParent();
  while (fnPath) {
    const name = nameFromFunction(fnPath as unknown as NodePath, t);
    if (name) return name;
    fnPath = fnPath.getFunctionParent() as unknown as typeof fnPath | null;
  }
  return pascalFromFile(filename);
}

function nativeTagName(
  opening: t.JSXOpeningElement,
  t: typeof babelTypes,
): string | null {
  const name = opening.name;
  if (t.isJSXIdentifier(name)) {
    const tag = name.name;
    if (tag[0] && tag[0] === tag[0].toLowerCase()) return tag;
  }
  return null;
}

function attributeName(attr: t.JSXAttribute, t: typeof babelTypes): string | null {
  return t.isJSXIdentifier(attr.name) ? attr.name.name : null;
}

function hasAttribute(
  opening: t.JSXOpeningElement,
  attrName: string,
  t: typeof babelTypes,
): boolean {
  return opening.attributes.some(
    (attr) => t.isJSXAttribute(attr) && attributeName(attr as t.JSXAttribute, t) === attrName,
  );
}

function isInteractive(
  opening: t.JSXOpeningElement,
  opts: ResolvedOptions,
  t: typeof babelTypes,
): boolean {
  const tag = nativeTagName(opening, t);
  if (tag && opts.tags.has(tag)) return true;
  for (const attr of opening.attributes) {
    if (!t.isJSXAttribute(attr)) continue;
    const name = attributeName(attr as t.JSXAttribute, t);
    if (name && opts.handlers.has(name)) return true;
    const value = (attr as t.JSXAttribute).value;
    if (
      name === 'role' &&
      value &&
      t.isStringLiteral(value) &&
      (value.value === 'button' || value.value === 'link')
    ) {
      return true;
    }
  }
  return false;
}

function staticPrimitive(
  attr: t.JSXAttribute,
  t: typeof babelTypes,
): PrimitiveValue | undefined {
  const value = attr.value as unknown;
  if (value === null || value === undefined) return true;
  if (t.isStringLiteral(value as t.JSXAttribute['value'])) return (value as { value: string }).value;
  if (t.isJSXExpressionContainer(value as t.JSXAttribute['value'])) {
    const expr = (value as { expression: unknown }).expression;
    if (t.isStringLiteral(expr as t.JSXAttribute['value']))
      return (expr as { value: string }).value;
    if (t.isNumericLiteral(expr as t.JSXAttribute['value']))
      return (expr as { value: number }).value;
    if (t.isBooleanLiteral(expr as t.JSXAttribute['value']))
      return (expr as { value: boolean }).value;
    if (t.isNullLiteral(expr as t.JSXAttribute['value'])) return null;
  }
  return undefined;
}

function collectProps(
  opening: t.JSXOpeningElement,
  opts: ResolvedOptions,
  t: typeof babelTypes,
): Record<string, PrimitiveValue> {
  const props: Record<string, PrimitiveValue> = {};
  for (const attr of opening.attributes) {
    if (!t.isJSXAttribute(attr)) continue;
    const name = attributeName(attr as t.JSXAttribute, t);
    if (!name) continue;
    if (name === COMP_ATTR || name === PROPS_ATTR || name === LOC_ATTR || name === IGNORE_ATTR)
      continue;
    if (opts.handlers.has(name) || /^on[A-Z]/.test(name)) continue;
    if (isSensitiveKey(name) || opts.denylist.has(name.toLowerCase())) continue;
    const value = staticPrimitive(attr as t.JSXAttribute, t);
    if (value !== undefined) props[name] = value;
  }
  return props;
}

function sourceLocation(
  opening: t.JSXOpeningElement,
  filename: string,
  opts: ResolvedOptions,
): string | null {
  const loc = (opening as unknown as { loc?: { start: { line: number; column: number } } }).loc;
  if (!loc) return null;
  const rel = path.relative(opts.rootDir, filename) || path.basename(filename);
  return `${rel}:${loc.start.line}:${loc.start.column + 1}`;
}

/**
 * Babel plugin factory — use in babel.config.js, Next.js babel config, or .babelrc.
 *
 * @example
 * // babel.config.js
 * module.exports = {
 *   plugins: [['@fiber-analytics/compiler/babel', { includeSourceLocation: true }]],
 * };
 *
 * @example
 * // next.config.js
 * // next.config.js (requires custom babel via .babelrc or babel.config.js)
 * // See docs/integration-nextjs.md for SWC vs Babel setup.
 */
export function createBabelPlugin(): (api: { types: typeof babelTypes }, opts: BabelPluginOptions) => PluginObj {
  return function fiberAnalyticsBabelPlugin(api: { types: typeof babelTypes }, opts: BabelPluginOptions = {}) {
    const t = api.types;
    const resolved = resolveOptions(opts);

    return {
      name: 'fiber-analytics-tagger',
      visitor: {
        JSXOpeningElement(p) {
          const filename = (this as unknown as { filename?: string }).filename ?? 'unknown.tsx';
          const opening = p.node as t.JSXOpeningElement;

          if (hasAttribute(opening, COMP_ATTR, t)) return;
          if (hasAttribute(opening, IGNORE_ATTR, t)) return;
          if (!isInteractive(opening, resolved, t)) return;

          const componentName = resolveComponentName(
            p as unknown as NodePath,
            filename,
            t,
          );
          opening.attributes.push(
            t.jsxAttribute(t.jsxIdentifier(COMP_ATTR), t.stringLiteral(componentName)),
          );

          const props = collectProps(opening, resolved, t);
          if (Object.keys(props).length > 0) {
            opening.attributes.push(
              t.jsxAttribute(
                t.jsxIdentifier(PROPS_ATTR),
                t.jsxExpressionContainer(t.stringLiteral(JSON.stringify(props))),
              ),
            );
          }

          if (resolved.includeSourceLocation) {
            const loc = sourceLocation(opening, filename, resolved);
            if (loc) {
              opening.attributes.push(
                t.jsxAttribute(t.jsxIdentifier(LOC_ATTR), t.stringLiteral(loc)),
              );
            }
          }
        },
      },
    };
  };
}

export default createBabelPlugin();
