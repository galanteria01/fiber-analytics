'use client';

import dynamic from 'next/dynamic';

const ChartFallback = () => <div className="h-[220px] animate-pulse rounded-lg bg-white/5" />;

// recharts is heavy and client-only: load it in a separate chunk on the client
// (bundle-dynamic-imports). `ssr: false` is valid here because this module is a
// client component.
export const DynamicBreakdownChart = dynamic(() => import('./BreakdownChart'), {
  ssr: false,
  loading: ChartFallback,
});

export const DynamicComponentsChart = dynamic(() => import('./ComponentsChart'), {
  ssr: false,
  loading: ChartFallback,
});
