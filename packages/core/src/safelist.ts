import type { EventProperties, PrimitiveValue } from './schema.js';
import { SENSITIVE_PROP_PATTERNS } from './constants.js';

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
 * Returns true when a property name matches the sensitive denylist and must be
 * dropped regardless of its (primitive) value.
 */
export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  for (const pattern of SENSITIVE_PROP_PATTERNS) {
    if (lower.includes(pattern)) return true;
  }
  return false;
}

/**
 * Projects an arbitrary record down to only its primitive, non-sensitive
 * entries. Used both at build time (compiler plugin) and capture time (SDK) so
 * the same safelist + denylist rules are applied everywhere.
 */
export function safelistProps(input: Record<string, unknown>): EventProperties {
  const out: EventProperties = {};
  for (const key in input) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    if (isSensitiveKey(key)) continue;
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
