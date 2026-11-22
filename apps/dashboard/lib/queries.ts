import { cache } from 'react';
import { eventsSource, hasData, query } from './duckdb';
import { buildWhere, type Filters } from './filters';

/** Primary journey key: client session_id, falling back to the server hash. */
const JOURNEY = `COALESCE(NULLIF(session_id, ''), session_hash)`;

export interface Summary {
  total_events: number;
  sessions: number;
  components: number;
  pageviews: number;
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
  session_id: string;
}

export interface SessionRow {
  session_id: string;
  domain: string;
  first_seen: string;
  last_seen: string;
  events: number;
  pageviews: number;
  entry_page: string;
  exit_page: string;
  device: string | null;
}

export interface TimelineEvent {
  occurred_at: string;
  timestamp: string;
  seq: number;
  event_type: string;
  event_name: string | null;
  component_name: string;
  pageview_id: string;
  url_path: string;
  page_title: string | null;
  properties: string;
  source_loc: string | null;
  referrer: string | null;
}

export interface PathRow {
  path: string;
  sessions: number;
  avg_depth: number;
}

export interface ComponentStats {
  events: number;
  sessions: number;
  byType: BreakdownRow[];
  pages: { url_path: string; events: number }[];
  trend: { day: string; events: number }[];
}

export interface FilterOptions {
  domains: string[];
  eventTypes: string[];
  components: string[];
}

const EMPTY_SUMMARY: Summary = { total_events: 0, sessions: 0, components: 0, pageviews: 0 };

export const getSummary = cache(async (filters: Filters = {}): Promise<Summary> => {
  if (!(await hasData())) return EMPTY_SUMMARY;
  const src = await eventsSource();
  const where = buildWhere(filters);
  const rows = await query<Summary>(
    `SELECT
       count(*) AS total_events,
       count(DISTINCT ${JOURNEY}) AS sessions,
       count(DISTINCT NULLIF(component_name, '')) AS components,
       count(DISTINCT pageview_id) AS pageviews
     FROM ${src} WHERE 1=1${where.sql}`,
    where.params,
  );
  return rows[0] ?? EMPTY_SUMMARY;
});

export const getEventBreakdown = cache(async (filters: Filters = {}): Promise<BreakdownRow[]> => {
  if (!(await hasData())) return [];
  const src = await eventsSource();
  const where = buildWhere(filters);
  return query<BreakdownRow>(
    `SELECT event_type, count(*) AS count
     FROM ${src} WHERE 1=1${where.sql}
     GROUP BY event_type ORDER BY count DESC`,
    where.params,
  );
});

export const getTopComponents = cache(async (filters: Filters = {}): Promise<ComponentRow[]> => {
  if (!(await hasData())) return [];
  const src = await eventsSource();
  const where = buildWhere(filters);
  return query<ComponentRow>(
    `SELECT component_name, count(*) AS events
     FROM ${src} WHERE component_name <> ''${where.sql}
     GROUP BY component_name ORDER BY events DESC LIMIT 10`,
    where.params,
  );
});

export const getFunnel = cache(async (filters: Filters = {}): Promise<FunnelStep[]> => {
  if (!(await hasData())) return [];
  const src = await eventsSource();
  const where = buildWhere(filters);
  const rows = await query<{ visited: number; clicked: number; changed: number }>(
    `SELECT
       count(DISTINCT ${JOURNEY}) AS visited,
       count(DISTINCT ${JOURNEY}) FILTER (WHERE event_type = 'click') AS clicked,
       count(DISTINCT ${JOURNEY}) FILTER (WHERE event_type IN ('state_change','input','submit')) AS changed
     FROM ${src} WHERE 1=1${where.sql}`,
    where.params,
  );
  const row = rows[0] ?? { visited: 0, clicked: 0, changed: 0 };
  return [
    { label: 'Visited', sessions: row.visited },
    { label: 'Clicked an element', sessions: row.clicked },
    { label: 'Changed state', sessions: row.changed },
  ];
});

export const getRecentEvents = cache(async (filters: Filters = {}): Promise<RecentEvent[]> => {
  if (!(await hasData())) return [];
  const src = await eventsSource();
  const where = buildWhere(filters);
  return query<RecentEvent>(
    `SELECT
       CAST(timestamp AS VARCHAR) AS timestamp,
       event_type, component_name, url_path,
       ${JOURNEY} AS session_id
     FROM ${src} WHERE 1=1${where.sql}
     ORDER BY timestamp DESC LIMIT 25`,
    where.params,
  );
});

export const getSessions = cache(async (filters: Filters = {}): Promise<SessionRow[]> => {
  if (!(await hasData())) return [];
  const src = await eventsSource();
  const where = buildWhere(filters);
  return query<SessionRow>(
    `SELECT
       ${JOURNEY} AS session_id,
       any_value(domain) AS domain,
       CAST(min(timestamp) AS VARCHAR) AS first_seen,
       CAST(max(timestamp) AS VARCHAR) AS last_seen,
       count(*) AS events,
       count(DISTINCT pageview_id) AS pageviews,
       arg_min(url_path, COALESCE(seq, 0)) AS entry_page,
       arg_max(url_path, COALESCE(seq, 0)) AS exit_page,
       any_value(device) AS device
     FROM ${src} WHERE 1=1${where.sql}
     GROUP BY ${JOURNEY}
     ORDER BY last_seen DESC LIMIT 100`,
    where.params,
  );
});

export const getSessionTimeline = cache(async (sessionId: string): Promise<TimelineEvent[]> => {
  if (!(await hasData())) return [];
  const src = await eventsSource();
  return query<TimelineEvent>(
    `SELECT
       CAST(occurred_at AS VARCHAR) AS occurred_at,
       CAST(timestamp AS VARCHAR) AS timestamp,
       seq, event_type, event_name, component_name, pageview_id,
       url_path, page_title, CAST(properties AS VARCHAR) AS properties,
       source_loc, referrer
     FROM ${src}
     WHERE ${JOURNEY} = $1
     ORDER BY COALESCE(seq, 0) ASC, occurred_at ASC, timestamp ASC`,
    [sessionId],
  );
});

export const getPaths = cache(async (filters: Filters = {}): Promise<PathRow[]> => {
  if (!(await hasData())) return [];
  const src = await eventsSource();
  const where = buildWhere(filters);
  return query<PathRow>(
    `WITH steps AS (
       SELECT ${JOURNEY} AS journey, url_path, min(COALESCE(seq, 0)) AS first_seq
       FROM ${src} WHERE 1=1${where.sql}
       GROUP BY ${JOURNEY}, url_path
     ), seqd AS (
       SELECT journey,
              string_agg(url_path, ' → ' ORDER BY first_seq) AS path,
              count(*) AS depth
       FROM steps GROUP BY journey
     )
     SELECT path, count(*) AS sessions, avg(depth) AS avg_depth
     FROM seqd GROUP BY path ORDER BY sessions DESC LIMIT 20`,
    where.params,
  );
});

export const getComponentStats = cache(
  async (name: string, filters: Filters = {}): Promise<ComponentStats> => {
    const empty: ComponentStats = { events: 0, sessions: 0, byType: [], pages: [], trend: [] };
    if (!(await hasData())) return empty;
    const src = await eventsSource();
    const where = buildWhere(filters, 2);
    const params = [name, ...where.params];

    const [totals, byType, pages, trend] = await Promise.all([
      query<{ events: number; sessions: number }>(
        `SELECT count(*) AS events, count(DISTINCT ${JOURNEY}) AS sessions
         FROM ${src} WHERE component_name = $1${where.sql}`,
        params,
      ),
      query<BreakdownRow>(
        `SELECT event_type, count(*) AS count
         FROM ${src} WHERE component_name = $1${where.sql}
         GROUP BY event_type ORDER BY count DESC`,
        params,
      ),
      query<{ url_path: string; events: number }>(
        `SELECT url_path, count(*) AS events
         FROM ${src} WHERE component_name = $1${where.sql}
         GROUP BY url_path ORDER BY events DESC LIMIT 10`,
        params,
      ),
      query<{ day: string; events: number }>(
        `SELECT strftime(timestamp, '%Y-%m-%d') AS day, count(*) AS events
         FROM ${src} WHERE component_name = $1${where.sql}
         GROUP BY day ORDER BY day`,
        params,
      ),
    ]);

    return {
      events: totals[0]?.events ?? 0,
      sessions: totals[0]?.sessions ?? 0,
      byType,
      pages,
      trend,
    };
  },
);

export const getFilterOptions = cache(async (): Promise<FilterOptions> => {
  if (!(await hasData())) return { domains: [], eventTypes: [], components: [] };
  const src = await eventsSource();
  const [domains, eventTypes, components] = await Promise.all([
    query<{ v: string }>(
      `SELECT DISTINCT domain AS v FROM ${src} WHERE domain IS NOT NULL ORDER BY v`,
    ),
    query<{ v: string }>(
      `SELECT DISTINCT event_type AS v FROM ${src} WHERE event_type IS NOT NULL ORDER BY v`,
    ),
    query<{ v: string }>(
      `SELECT component_name AS v FROM ${src} WHERE component_name <> ''
       GROUP BY component_name ORDER BY count(*) DESC LIMIT 50`,
    ),
  ]);
  return {
    domains: domains.map((r) => r.v),
    eventTypes: eventTypes.map((r) => r.v),
    components: components.map((r) => r.v),
  };
});
