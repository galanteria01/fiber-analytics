import type { DuckDBValue } from '@duckdb/node-api';

/**
 * User-driven filters parsed from the URL search params. Every value flows into
 * queries exclusively as a bound parameter (never string-interpolated) to
 * prevent SQL injection.
 */
export interface Filters {
  from?: string;
  to?: string;
  domain?: string;
  eventType?: string;
  component?: string;
  url?: string;
}

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.length > 0 ? v : undefined;
}

/** Parses raw Next.js `searchParams` into a typed {@link Filters} object. */
export function parseFilters(params: SearchParams): Filters {
  return {
    from: one(params.from),
    to: one(params.to),
    domain: one(params.domain),
    eventType: one(params.type),
    component: one(params.component),
    url: one(params.url),
  };
}

export interface WhereClause {
  /** SQL fragment beginning with `AND ...`, or empty string when no filters. */
  sql: string;
  params: DuckDBValue[];
}

/**
 * Builds a parameterized WHERE fragment from filters. Returns positional `$n`
 * placeholders and the matching ordered params array. Pass `startIndex` to
 * compose after other bound params.
 */
export function buildWhere(filters: Filters, startIndex = 1): WhereClause {
  const conditions: string[] = [];
  const params: DuckDBValue[] = [];
  let i = startIndex;

  if (filters.from) {
    conditions.push(`timestamp >= CAST($${i} AS TIMESTAMP)`);
    params.push(filters.from);
    i += 1;
  }
  if (filters.to) {
    conditions.push(`timestamp <= CAST($${i} AS TIMESTAMP)`);
    // A date-only bound is made inclusive of the whole day.
    params.push(filters.to.length === 10 ? `${filters.to} 23:59:59` : filters.to);
    i += 1;
  }
  if (filters.domain) {
    conditions.push(`domain = $${i}`);
    params.push(filters.domain);
    i += 1;
  }
  if (filters.eventType) {
    conditions.push(`event_type = $${i}`);
    params.push(filters.eventType);
    i += 1;
  }
  if (filters.component) {
    conditions.push(`component_name = $${i}`);
    params.push(filters.component);
    i += 1;
  }
  if (filters.url) {
    conditions.push(`url_path ILIKE $${i}`);
    params.push(`%${filters.url}%`);
    i += 1;
  }

  return { sql: conditions.length ? ` AND ${conditions.join(' AND ')}` : '', params };
}

/** Serializes filters back into a query string (for links that preserve state). */
export function filtersToQuery(filters: Filters): string {
  const sp = new URLSearchParams();
  if (filters.from) sp.set('from', filters.from);
  if (filters.to) sp.set('to', filters.to);
  if (filters.domain) sp.set('domain', filters.domain);
  if (filters.eventType) sp.set('type', filters.eventType);
  if (filters.component) sp.set('component', filters.component);
  if (filters.url) sp.set('url', filters.url);
  const s = sp.toString();
  return s ? `?${s}` : '';
}
