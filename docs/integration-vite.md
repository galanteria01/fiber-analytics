# Vite integration

> Automatic JSX tagging at build time — no manual `track()` calls per component.

## What it does

`@fiber-analytics/vite-plugin` is a Babel AST transform registered with `enforce: 'pre'` so it runs before `@vitejs/plugin-react` compiles JSX away. For every interactive JSX element it injects:

- `data-fa-comp="<ComponentName>"` — component identity resolved from the nearest enclosing function (`function Foo`, `const Foo = () => {}`, `memo`/`forwardRef` wrappers, `Foo.displayName`), falling back to a PascalCase of the filename.
- `data-fa-props='{"key":"value"}'` — safelisted primitive props present on the element at build time, with sensitive keys redacted (see below).
- `data-fa-loc="src/Button.tsx:12:4"` — build-time source location, only when enabled (see `includeSourceLocation`).

Elements that already carry `data-fa-comp` are left untouched (idempotent transform). Elements marked with `data-fa-ignore` are skipped entirely.

## Installation

```bash
pnpm add -D @fiber-analytics/vite-plugin
```

## Minimal `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fiberAnalytics } from '@fiber-analytics/vite-plugin';

export default defineConfig({
  plugins: [
    fiberAnalytics({
      includeSourceLocation: true,
    }),
    react(),
  ],
});
```

Order matters: `fiberAnalytics()` must appear **before** `react()` (or any other JSX-compiling plugin) so it sees the original JSX. The plugin declares `enforce: 'pre'` so it runs early even when listed in a different order, but putting it first makes the intent explicit.

## Plugin options

All options are defined in `packages/vite-plugin/src/transform.ts:TransformOptions` and re-exported from `packages/vite-plugin/src/index.ts`.

| Option                  | Type                      | Default                                                     | Description                                                                                                                                                                 |
| ----------------------- | ------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `includeSourceLocation` | `boolean`                 | `false`                                                     | When `true`, injects `data-fa-loc="file:line:col"` for trace-to-source in the dashboard.                                                                                    |
| `rootDir`               | `string`                  | Vite's resolved `config.root`                               | Project root used to relativize `data-fa-loc` paths. Override when your Vite root is not the repo root.                                                                     |
| `interactiveTags`       | `string[]`                | `button, a, input, select, textarea, summary`               | Extra native tags to treat as interactive (merged with the defaults).                                                                                                       |
| `interactiveHandlers`   | `string[]`                | `onClick, onChange, onInput, onSubmit, onKeyDown, onToggle` | Extra handler prop names that mark an element interactive (merged with the defaults). An element is tagged when it either has an interactive tag or an interactive handler. |
| `propDenylist`          | `string[]`                | _(core denylist only)_                                      | Additional prop names to never capture (merged with `SENSITIVE_PROP_PATTERNS`). Matched case-insensitively.                                                                 |
| `include`               | `(id: string) => boolean` | _(all non-`node_modules` `.jsx`/`.tsx`)_                    | Custom file filter. The plugin already skips `node_modules` and non-JSX files; use this to narrow further (e.g. exclude a design-system package).                           |

### Example: denylist + extra tag

```ts
fiberAnalytics({
  includeSourceLocation: true,
  interactiveTags: ['my-button'],
  propDenylist: ['internalId', 'traceId'],
});
```

Any attribute whose name case-insensitively matches `SENSITIVE_PROP_PATTERNS` (`password`, `token`, `email`, `secret`, `ssn`, `creditcard`, `cvv`, `phone`, etc. — see `packages/core/src/constants.ts`) is already dropped before `propDenylist` is checked. Only static primitive values (`string`, `number`, `boolean`, `null`) are captured; objects, arrays, and dynamic expressions are ignored to avoid leaking PII and bloating payloads.

## `data-fa-ignore` attribute

Add `data-fa-ignore` to any JSX element to opt it out of tagging. This is useful for:

- Sensitive forms (login, checkout) where you don't want any prop capture.
- Third-party widgets whose interactions should not be tracked.

```tsx
<button data-fa-ignore onClick={handleSecret}>
  Don't track this
</button>
```

The element and all `data-fa-*` injection for it are skipped. Children are still evaluated independently.

## How props are collected

At build time the transform inspects each interactive element's JSX attributes and collects those that are:

1. Not one of `data-fa-comp`, `data-fa-props`, `data-fa-loc`, `data-fa-ignore`.
2. Not a handler prop (`on*`).
3. Not matching `isSensitiveKey(name)` (core denylist) or `propDenylist` (user denylist).
4. A static primitive (`"hello"`, `{42}`, `{true}`, `null`). Dynamic identifiers, function calls, and object literals are ignored.

The collected props are serialized as JSON and emitted as `data-fa-props={"..."} ` (an expression container to avoid quote escaping issues with the downstream React plugin).

## Related docs

- [Architecture](architecture.md) — where the compiler sits in the data flow.
- [Browser SDK](integration-react.md) — how the SDK reads these attributes at capture time.
- [Privacy](privacy.md) — build-time redaction and ingest-time validation.
