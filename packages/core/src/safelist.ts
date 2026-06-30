import type { EventProperties, PrimitiveValue } from './schema.js';

/**
 * Returns true for values that are safe to persist directly (JSON primitives).
 * Objects, arrays, and functions are rejected to avoid leaking PII or bloating
 * payloads.
 */
export function isSafePrimitive(value: unknown): value is PrimitiveValue {
  if (value === null) return true;
  const t = typeof value;
  return t === 'string' || t === 'number' || t === 'boolean';
}

/**
 * Projects an arbitrary record down to only its primitive entries. Used both at
 * build time (compiler plugin) and capture time (SDK) so the same safelist rule
 * is applied everywhere.
 */
export function safelistProps(input: Record<string, unknown>): EventProperties {
  const out: EventProperties = {};
  for (const key in input) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    const value = input[key];
    if (isSafePrimitive(value)) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Parses a `data-fa-props` attribute value into a safelisted properties object.
 * Never throws: malformed JSON yields an empty object.
 */
export function parsePropsAttr(raw: string | null | undefined): EventProperties {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return safelistProps(parsed as Record<string, unknown>);
    }
  } catch {
    // ignore malformed attribute values
  }
  return {};
}
