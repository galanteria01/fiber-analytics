import { describe, expect, it } from 'vitest';
import { isSafePrimitive, parsePropsAttr, safelistProps } from './safelist.js';

describe('isSafePrimitive', () => {
  it('accepts json primitives', () => {
    expect(isSafePrimitive('x')).toBe(true);
    expect(isSafePrimitive(1)).toBe(true);
    expect(isSafePrimitive(true)).toBe(true);
    expect(isSafePrimitive(null)).toBe(true);
  });

  it('rejects non-primitives', () => {
    expect(isSafePrimitive({})).toBe(false);
    expect(isSafePrimitive([])).toBe(false);
    expect(isSafePrimitive(() => {})).toBe(false);
    expect(isSafePrimitive(undefined)).toBe(false);
  });
});

describe('safelistProps', () => {
  it('keeps only primitive entries', () => {
    const result = safelistProps({
      label: 'Save',
      count: 3,
      enabled: false,
      onClick: () => {},
      meta: { nested: true },
      tags: ['a'],
    });
    expect(result).toEqual({ label: 'Save', count: 3, enabled: false });
  });
});

describe('parsePropsAttr', () => {
  it('parses valid json objects and safelists them', () => {
    expect(parsePropsAttr('{"label":"Save","bad":{"x":1}}')).toEqual({ label: 'Save' });
  });

  it('returns empty object for malformed or empty input', () => {
    expect(parsePropsAttr(undefined)).toEqual({});
    expect(parsePropsAttr('')).toEqual({});
    expect(parsePropsAttr('not json')).toEqual({});
    expect(parsePropsAttr('[1,2,3]')).toEqual({});
  });
});
