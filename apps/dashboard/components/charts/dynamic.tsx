'use client';

import dynamic from 'next/dynamic';

import { Skeleton } from '@/components/ui/skeleton';

const ChartFallback = () => <Skeleton className="h-[240px] w-full" />;

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
