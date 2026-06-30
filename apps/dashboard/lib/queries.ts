import { cache } from 'react';
import { EVENTS_SOURCE, hasData, query } from './duckdb';

export interface Summary {
  total_events: number;
  sessions: number;
  components: number;
}

export interface BreakdownRow {
  event_type: string;
  count: number;
}

export interface ComponentRow {
  component_name: string;
  events: number;
}

export interface FunnelStep {
  label: string;
  sessions: number;
}

export interface RecentEvent {
  timestamp: string;
  event_type: string;
  component_name: string;
  url_path: string;
}

const EMPTY_SUMMARY: Summary = { total_events: 0, sessions: 0, components: 0 };

/**
 * Per-request memoized summary. `cache()` dedupes repeated calls within a single
 * render pass so multiple panels can request the same data for free.
 */
export const getSummary = cache(async (): Promise<Summary> => {
  if (!(await hasData())) return EMPTY_SUMMARY;
  const rows = await query<Summary>(`
    SELECT
      count(*) AS total_events,
      count(DISTINCT session_hash) AS sessions,
      count(DISTINCT component_name) AS components
    FROM ${EVENTS_SOURCE}
  `);
  return rows[0] ?? EMPTY_SUMMARY;
});

export const getEventBreakdown = cache(async (): Promise<BreakdownRow[]> => {
  if (!(await hasData())) return [];
  return query<BreakdownRow>(`
    SELECT event_type, count(*) AS count
    FROM ${EVENTS_SOURCE}
    GROUP BY event_type
    ORDER BY count DESC
  `);
});

export const getTopComponents = cache(async (): Promise<ComponentRow[]> => {
  if (!(await hasData())) return [];
  return query<ComponentRow>(`
    SELECT component_name, count(*) AS events
    FROM ${EVENTS_SOURCE}
    GROUP BY component_name
    ORDER BY events DESC
    LIMIT 10
  `);
});

export const getFunnel = cache(async (): Promise<FunnelStep[]> => {
  if (!(await hasData())) return [];
  const rows = await query<{ visited: number; clicked: number; changed: number }>(`
    SELECT
      count(DISTINCT session_hash) AS visited,
      count(DISTINCT session_hash) FILTER (WHERE event_type = 'click') AS clicked,
      count(DISTINCT session_hash) FILTER (WHERE event_type = 'state_change') AS changed
    FROM ${EVENTS_SOURCE}
  `);
  const row = rows[0] ?? { visited: 0, clicked: 0, changed: 0 };
  return [
    { label: 'Visited', sessions: row.visited },
    { label: 'Clicked an element', sessions: row.clicked },
    { label: 'Changed state', sessions: row.changed },
  ];
});

export const getRecentEvents = cache(async (): Promise<RecentEvent[]> => {
  if (!(await hasData())) return [];
  return query<RecentEvent>(`
    SELECT
      CAST(timestamp AS VARCHAR) AS timestamp,
      event_type,
      component_name,
      url_path
    FROM ${EVENTS_SOURCE}
    ORDER BY timestamp DESC
    LIMIT 25
  `);
});
