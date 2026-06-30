import { Panel, EmptyState } from '@/components/ui/Panel';
import { DynamicBreakdownChart } from '@/components/charts/dynamic';
import { getEventBreakdown } from '@/lib/queries';
import type { Filters } from '@/lib/filters';

export async function BreakdownPanel({ filters = {} }: { filters?: Filters }) {
  const data = await getEventBreakdown(filters);
  return (
    <Panel title="Event breakdown" description="Captured events by type.">
      {data.length === 0 ? <EmptyState /> : <DynamicBreakdownChart data={data} />}
    </Panel>
  );
}
