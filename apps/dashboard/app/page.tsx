import { Suspense } from 'react';
import { PanelSkeleton } from '@/components/ui/Panel';
import { SummaryPanel } from '@/components/panels/SummaryPanel';
import { BreakdownPanel } from '@/components/panels/BreakdownPanel';
import { TopComponentsPanel } from '@/components/panels/TopComponentsPanel';
import { FunnelPanel } from '@/components/panels/FunnelPanel';
import { RecentEventsPanel } from '@/components/panels/RecentEventsPanel';

// Always reflect the latest Parquet partitions.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl bg-white/5" />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  // Each panel fetches its own slice and is wrapped in its own Suspense
  // boundary so panels stream in independently (async-suspense-boundaries).
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold text-gray-50">FiberAnalytics</h1>
        <p className="mt-1 text-sm text-gray-400">
          Component-aware analytics queried in-process from Parquet with DuckDB.
        </p>
      </header>

      <Suspense fallback={<SummarySkeleton />}>
        <SummaryPanel />
      </Suspense>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Suspense fallback={<PanelSkeleton title="Event breakdown" />}>
          <BreakdownPanel />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Top components" />}>
          <TopComponentsPanel />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Session funnel" />}>
          <FunnelPanel />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Recent events" />}>
          <RecentEventsPanel />
        </Suspense>
      </div>
    </main>
  );
}
