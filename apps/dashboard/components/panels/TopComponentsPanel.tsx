import { Panel, EmptyState } from '@/components/ui/Panel';
import { DynamicComponentsChart } from '@/components/charts/dynamic';
import { getTopComponents } from '@/lib/queries';

export async function TopComponentsPanel() {
  const data = await getTopComponents();
  return (
    <Panel title="Top components" description="Most-interacted components across all events.">
      {data.length === 0 ? <EmptyState /> : <DynamicComponentsChart data={data} />}
    </Panel>
  );
}
