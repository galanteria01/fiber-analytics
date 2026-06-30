import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { FilterBar } from '@/components/FilterBar';
import { Panel, EmptyState } from '@/components/ui/Panel';
import { getFilterOptions, getPaths } from '@/lib/queries';
import { parseFilters } from '@/lib/filters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PathsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseFilters(await searchParams);
  const [paths, options] = await Promise.all([getPaths(filters), getFilterOptions()]);
  const max = paths[0]?.sessions ?? 0;

  return (
    <div className="min-h-screen">
      <DashboardHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <FilterBar action="/paths" filters={filters} options={options} />
        <Panel
          title="Path analysis"
          description="The most common ordered sequences of pages visited within a session."
        >
          {paths.length === 0 ? (
            <EmptyState />
          ) : (
            <ol className="flex flex-col gap-3">
              {paths.map((row, i) => {
                const pct = max > 0 ? Math.round((row.sessions / max) * 100) : 0;
                return (
                  <li key={`${row.path}-${i}`} className="space-y-1">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">{row.path}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {row.sessions.toLocaleString()} sessions · {row.avg_depth.toFixed(1)} pages
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </main>
    </div>
  );
}
