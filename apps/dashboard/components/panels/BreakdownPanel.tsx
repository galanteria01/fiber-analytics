import { Panel, EmptyState } from '@/components/ui/Panel';
import { DynamicBreakdownChart } from '@/components/charts/dynamic';
import { getEventBreakdown } from '@/lib/queries';

export async function BreakdownPanel() {
  const data = await getEventBreakdown();
  return (
    <Panel title="Event breakdown" description="Captured events by type.">
      {data.length === 0 ? <EmptyState /> : <DynamicBreakdownChart data={data} />}
    </Panel>
  );
}
