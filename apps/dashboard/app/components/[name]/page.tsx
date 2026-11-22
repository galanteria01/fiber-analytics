import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Panel, EmptyState } from '@/components/ui/Panel';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getComponentStats } from '@/lib/queries';
import { parseFilters } from '@/lib/filters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-3xl font-semibold tracking-tight">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

export default async function ComponentPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { name } = await params;
  const componentName = decodeURIComponent(name);
  const filters = parseFilters(await searchParams);
  const stats = await getComponentStats(componentName, filters);

  return (
    <div className="min-h-screen">
      <DashboardHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to overview
          </Link>
          <h1 className="text-lg font-semibold">{componentName}</h1>
        </div>

        {stats.events === 0 ? (
          <Panel title="Component" description="No events for this component in range.">
            <EmptyState />
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Stat label="Total events" value={stats.events} />
              <Stat label="Sessions" value={stats.sessions} />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Panel title="By event type" description="Interaction mix for this component.">
                <ul className="flex flex-col gap-2">
                  {stats.byType.map((row) => (
                    <li key={row.event_type} className="flex items-center justify-between text-sm">
                      <Badge variant="outline">{row.event_type}</Badge>
                      <span className="tabular-nums text-muted-foreground">{row.count}</span>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Pages used on" description="Where this component is interacted with.">
                <ul className="flex flex-col gap-2">
                  {stats.pages.map((row) => (
                    <li key={row.url_path} className="flex items-center justify-between text-sm">
                      <span className="truncate font-mono text-xs">{row.url_path}</span>
                      <span className="tabular-nums text-muted-foreground">{row.events}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>

            <Panel title="Daily trend" description="Events per day.">
              <ul className="flex flex-col gap-1.5">
                {stats.trend.map((row) => {
                  const max = Math.max(...stats.trend.map((t) => t.events), 1);
                  const pct = Math.round((row.events / max) * 100);
                  return (
                    <li key={row.day} className="flex items-center gap-3 text-xs">
                      <span className="w-24 shrink-0 font-mono text-muted-foreground">
                        {row.day}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-10 text-right tabular-nums text-muted-foreground">
                        {row.events}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </>
        )}
      </main>
    </div>
  );
}
