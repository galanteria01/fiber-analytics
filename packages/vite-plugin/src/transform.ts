import { transformSync, type PluginObj, type NodePath, types as t } from '@babel/core';
import {
  COMP_ATTR,
  PROPS_ATTR,
  INTERACTIVE_TAGS,
  INTERACTIVE_HANDLERS,
  type PrimitiveValue,
} from '@fiber-analytics/core';

const TS_EXTENSIONS = /\.tsx?$/;

/**
 * Resolves the name of the nearest enclosing React component for a JSX node.
 * Handles both `function Foo() {}` declarations and `const Foo = () => {}`
 * style components.
 */
function resolveComponentName(path: NodePath): string | null {
  let fnPath = path.getFunctionParent();
  while (fnPath) {
    const node = fnPath.node;
    if (t.isFunctionDeclaration(node) && node.id) {
      return node.id.name;
    }
    const parent = fnPath.parentPath;
    if (parent && t.isVariableDeclarator(parent.node) && t.isIdentifier(parent.node.id)) {
      return parent.node.id.name;
    }
    fnPath = fnPath.getFunctionParent();
  }
  return null;
}

/**
 * Returns the lowercase tag name for a native element, or null for component
 * elements (which start with an uppercase letter / member expression).
 */
function nativeTagName(opening: t.JSXOpeningElement): string | null {
  const name = opening.name;
  if (t.isJSXIdentifier(name)) {
    const tag = name.name;
    // Native DOM tags are lowercase by JSX convention.
    if (tag[0] && tag[0] === tag[0].toLowerCase()) return tag;
  }
  return null;
}

function attributeName(attr: t.JSXAttribute): string | null {
  return t.isJSXIdentifier(attr.name) ? attr.name.name : null;
}

function isInteractive(opening: t.JSXOpeningElement): boolean {
  const tag = nativeTagName(opening);
  if (tag && INTERACTIVE_TAGS.has(tag)) return true;

  for (const attr of opening.attributes) {
    if (!t.isJSXAttribute(attr)) continue;
    const name = attributeName(attr);
    if (name && INTERACTIVE_HANDLERS.has(name)) return true;
  }
  return false;
}

function isAlreadyTagged(opening: t.JSXOpeningElement): boolean {
  return opening.attributes.some(
    (attr) => t.isJSXAttribute(attr) && attributeName(attr) === COMP_ATTR,
  );
}

/**
 * Extracts a primitive value from a static JSX attribute, or returns
 * `undefined` for non-static / non-primitive attributes (which are skipped).
 */
function staticPrimitive(attr: t.JSXAttribute): PrimitiveValue | undefined {
  const value = attr.value;
  // Bare attribute, e.g. `disabled` -> true
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

/**
 * Collects safelisted primitive props from an opening element, skipping event
 * handlers and the analytics attributes themselves.
 */
function collectProps(opening: t.JSXOpeningElement): Record<string, PrimitiveValue> {
  const props: Record<string, PrimitiveValue> = {};
  for (const attr of opening.attributes) {
    if (!t.isJSXAttribute(attr)) continue;
    const name = attributeName(attr);
    if (!name) continue;
    if (name === COMP_ATTR || name === PROPS_ATTR) continue;
    if (INTERACTIVE_HANDLERS.has(name) || name.startsWith('on')) continue;
    const value = staticPrimitive(attr);
    if (value !== undefined) props[name] = value;
  }
  return props;
}

function fiberAnalyticsBabelPlugin(): PluginObj {
  return {
    name: 'fiber-analytics-tagger',
    visitor: {
      JSXOpeningElement(path) {
        const opening = path.node;
        if (isAlreadyTagged(opening)) return;
        if (!isInteractive(opening)) return;

        const componentName = resolveComponentName(path) ?? 'Anonymous';

        opening.attributes.push(
          t.jsxAttribute(t.jsxIdentifier(COMP_ATTR), t.stringLiteral(componentName)),
        );

        const props = collectProps(opening);
        if (Object.keys(props).length > 0) {
          // Emit as an expression container (`={"..."}`) rather than a plain
          // string attribute: the JSON contains double quotes, which are not
          // valid in a JSX string attribute when this output is re-parsed by
          // the React plugin downstream.
          opening.attributes.push(
            t.jsxAttribute(
              t.jsxIdentifier(PROPS_ATTR),
              t.jsxExpressionContainer(t.stringLiteral(JSON.stringify(props))),
            ),
          );
        }
      },
    },
  };
}

/**
 * Minimal raw source map shape, structurally compatible with the type Vite /
 * Rollup expect from a plugin `transform` hook. Babel types its own map as the
 * opaque `object`, so we narrow it here.
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
 * interactive JSX. Returns `null` when the file contains no JSX to transform.
 */
export function transformSource(
  code: string,
  filename: string,
): TransformResult | null {
  const isTs = TS_EXTENSIONS.test(filename);
  const parserPlugins = isTs ? ['jsx' as const, 'typescript' as const] : ['jsx' as const];

  const result = transformSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    sourceMaps: true,
    parserOpts: { plugins: parserPlugins },
    plugins: [fiberAnalyticsBabelPlugin()],
  });

  if (!result || result.code == null) return null;
  return { code: result.code, map: (result.map as unknown as RawSourceMap) ?? null };
}
