import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Code2, FileText } from 'lucide-react';

import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/badge';
import { getSessionTimeline, type TimelineEvent } from '@/lib/queries';
import { formatDateTime, humanizeDuration } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TYPE_COLOR: Record<string, string> = {
  click: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  view: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
  state_change: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  page_view: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
  submit: 'bg-pink-500/15 text-pink-600 dark:text-pink-300',
  input: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300',
  custom: 'bg-orange-500/15 text-orange-600 dark:text-orange-300',
};

function eventTime(e: TimelineEvent): number {
  const occurred = Date.parse(e.occurred_at);
  return Number.isNaN(occurred) ? Date.parse(e.timestamp) : occurred;
}

function parseProps(raw: string): [string, unknown][] {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(obj);
  } catch {
    return [];
  }
}

interface PageGroup {
  pageviewId: string;
  url: string;
  title: string | null;
  events: TimelineEvent[];
}

function groupByPageview(events: TimelineEvent[]): PageGroup[] {
  const groups: PageGroup[] = [];
  for (const event of events) {
    const last = groups[groups.length - 1];
    if (!last || last.pageviewId !== event.pageview_id) {
      groups.push({
        pageviewId: event.pageview_id,
        url: event.url_path,
        title: event.page_title,
        events: [event],
      });
    } else {
      last.events.push(event);
    }
  }
  return groups;
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionId = decodeURIComponent(id);
  const events = await getSessionTimeline(sessionId);
  if (events.length === 0) notFound();

  const start = eventTime(events[0]!);
  const end = eventTime(events[events.length - 1]!);
  const groups = groupByPageview(events);

  return (
    <div className="min-h-screen">
      <DashboardHeader />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-2">
          <Link href="/sessions" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to sessions
          </Link>
          <h1 className="font-mono text-lg font-semibold">{sessionId}</h1>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>{events.length} events</span>
            <span>·</span>
            <span>{groups.length} page views</span>
            <span>·</span>
            <span>{humanizeDuration(end - start)} total</span>
            <span>·</span>
            <span>started {formatDateTime(events[0]!.timestamp)}</span>
          </div>
        </div>

        <Panel title="Journey timeline" description="Chronological steps grouped by page view.">
          <div className="flex flex-col gap-6">
            {groups.map((group, gi) => {
              const groupStart = eventTime(group.events[0]!);
              return (
                <div key={`${group.pageviewId}-${gi}`} className="rounded-lg border">
                  <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2">
                    <FileText className="h-4 w-4 text-violet-500" />
                    <span className="font-mono text-sm">{group.url}</span>
                    {group.title ? (
                      <span className="truncate text-xs text-muted-foreground">— {group.title}</span>
                    ) : null}
                    <span className="ml-auto text-xs text-muted-foreground">
                      +{humanizeDuration(groupStart - start)}
                    </span>
                  </div>
                  <ol className="divide-y">
                    {group.events.map((event, ei) => {
                      const t = eventTime(event);
                      const prev = ei > 0 ? eventTime(group.events[ei - 1]!) : groupStart;
                      const delta = t - prev;
                      const props = parseProps(event.properties);
                      return (
                        <li key={`${event.seq}-${ei}`} className="flex gap-3 px-4 py-3">
                          <div className="w-16 shrink-0 pt-0.5 text-right">
                            <span className="text-xs tabular-nums text-muted-foreground">
                              +{humanizeDuration(t - start)}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary" className={TYPE_COLOR[event.event_type]}>
                                {event.event_type}
                              </Badge>
                              <span className="font-medium">
                                {event.event_name || event.component_name || '—'}
                              </span>
                              {delta > 0 && ei > 0 ? (
                                <span className="text-xs text-muted-foreground">
                                  {humanizeDuration(delta)} after previous
                                </span>
                              ) : null}
                            </div>
                            {props.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {props.map(([k, v]) => (
                                  <span
                                    key={k}
                                    className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                                  >
                                    {k}={String(v)}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {event.source_loc ? (
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Code2 className="h-3 w-3" />
                                <span className="font-mono">{event.source_loc}</span>
                              </div>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
          </div>
        </Panel>
      </main>
    </div>
  );
}
