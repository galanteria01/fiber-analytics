import { describe, expect, it } from 'vitest';
import { buildWhere, parseFilters, filtersToQuery } from './filters';

describe('parseFilters', () => {
  it('maps search params to filters', () => {
    const f = parseFilters({ from: '2026-06-01', type: 'click', url: '/checkout', empty: '' });
    expect(f.from).toBe('2026-06-01');
    expect(f.eventType).toBe('click');
    expect(f.url).toBe('/checkout');
    expect(f.domain).toBeUndefined();
  });
});

describe('buildWhere', () => {
  it('returns empty for no filters', () => {
    const w = buildWhere({});
    expect(w.sql).toBe('');
    expect(w.params).toEqual([]);
  });

  it('builds positional placeholders and ordered params', () => {
    const w = buildWhere({ domain: 'app.com', eventType: 'click' });
    expect(w.sql).toContain('domain = $1');
    expect(w.sql).toContain('event_type = $2');
    expect(w.params).toEqual(['app.com', 'click']);
  });

  it('makes a date-only "to" bound inclusive of the whole day', () => {
    const w = buildWhere({ to: '2026-06-30' });
    expect(w.params[0]).toBe('2026-06-30 23:59:59');
  });

  it('wraps url filter with wildcards for ILIKE', () => {
    const w = buildWhere({ url: 'checkout' });
    expect(w.sql).toContain('url_path ILIKE $1');
    expect(w.params[0]).toBe('%checkout%');
  });

  it('respects a custom start index', () => {
    const w = buildWhere({ domain: 'x' }, 3);
    expect(w.sql).toContain('domain = $3');
  });
});

describe('filtersToQuery', () => {
  it('serializes filters to a query string', () => {
    expect(filtersToQuery({ domain: 'app.com', eventType: 'click' })).toBe(
      '?domain=app.com&type=click',
    );
    expect(filtersToQuery({})).toBe('');
  });
});
