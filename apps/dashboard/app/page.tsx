import { Suspense } from 'react';

import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { FilterBar } from '@/components/FilterBar';
import { PanelSkeleton } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SummaryPanel } from '@/components/panels/SummaryPanel';
import { BreakdownPanel } from '@/components/panels/BreakdownPanel';
import { TopComponentsPanel } from '@/components/panels/TopComponentsPanel';
import { FunnelPanel } from '@/components/panels/FunnelPanel';
import { RecentEventsPanel } from '@/components/panels/RecentEventsPanel';
import { getFilterOptions } from '@/lib/queries';
import { parseFilters } from '@/lib/filters';

// Always reflect the latest Parquet partitions.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const options = await getFilterOptions();

  return (
    <div className="min-h-screen">
      <DashboardHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <FilterBar action="/" filters={filters} options={options} />

        <Suspense fallback={<SummarySkeleton />}>
          <SummaryPanel filters={filters} />
        </Suspense>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="components">Components</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Suspense fallback={<PanelSkeleton title="Event breakdown" />}>
                <BreakdownPanel filters={filters} />
              </Suspense>
              <Suspense fallback={<PanelSkeleton title="Session funnel" />}>
                <FunnelPanel filters={filters} />
              </Suspense>
              <div className="lg:col-span-2">
                <Suspense fallback={<PanelSkeleton title="Top components" />}>
                  <TopComponentsPanel filters={filters} />
                </Suspense>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="components" className="mt-4">
            <Suspense fallback={<PanelSkeleton title="Top components" />}>
              <TopComponentsPanel filters={filters} />
            </Suspense>
          </TabsContent>

          <TabsContent value="events" className="mt-4">
            <Suspense fallback={<PanelSkeleton title="Recent events" />}>
              <RecentEventsPanel filters={filters} />
            </Suspense>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
