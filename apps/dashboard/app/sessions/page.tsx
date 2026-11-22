import Link from 'next/link';
import { ArrowRight, Monitor, Smartphone, Tablet } from 'lucide-react';

import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { FilterBar } from '@/components/FilterBar';
import { Panel, EmptyState } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getFilterOptions, getSessions, type SessionRow } from '@/lib/queries';
import { parseFilters } from '@/lib/filters';
import { formatDateTime, humanizeDuration, relativeTime } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function DeviceIcon({ device }: { device: string | null }) {
  if (device === 'mobile') return <Smartphone className="h-4 w-4 text-muted-foreground" />;
  if (device === 'tablet') return <Tablet className="h-4 w-4 text-muted-foreground" />;
  return <Monitor className="h-4 w-4 text-muted-foreground" />;
}

function duration(row: SessionRow): string {
  return humanizeDuration(Date.parse(row.last_seen) - Date.parse(row.first_seen));
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseFilters(await searchParams);
  const [sessions, options] = await Promise.all([getSessions(filters), getFilterOptions()]);

  return (
    <div className="min-h-screen">
      <DashboardHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <FilterBar action="/sessions" filters={filters} options={options} />
        <Panel
          title="Sessions"
          description="Each row is one journey (client session). Select a session to view its timeline."
        >
          {sessions.length === 0 ? (
            <EmptyState />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Events</TableHead>
                  <TableHead className="text-right">Pages</TableHead>
                  <TableHead>Entry → Exit</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.session_id}>
                    <TableCell className="font-mono text-xs">
                      <span className="flex items-center gap-2">
                        <DeviceIcon device={s.device} />
                        {s.session_id.slice(0, 12)}…
                      </span>
                    </TableCell>
                    <TableCell
                      className="text-xs text-muted-foreground"
                      title={formatDateTime(s.last_seen)}
                    >
                      {relativeTime(s.last_seen)}
                    </TableCell>
                    <TableCell className="text-xs">{duration(s)}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.events}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.pageviews}</TableCell>
                    <TableCell className="max-w-[260px] truncate font-mono text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        {s.entry_page}
                        <ArrowRight className="h-3 w-3" />
                        {s.exit_page}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/sessions/${encodeURIComponent(s.session_id)}`}
                        className="text-xs text-primary hover:underline"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            <Badge variant="outline">{sessions.length}</Badge> sessions (most recent 100)
          </p>
        </Panel>
      </main>
    </div>
  );
}
