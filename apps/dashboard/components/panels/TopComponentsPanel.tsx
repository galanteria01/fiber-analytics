import Link from 'next/link';
import { Panel, EmptyState } from '@/components/ui/Panel';
import { DynamicComponentsChart } from '@/components/charts/dynamic';
import { getTopComponents } from '@/lib/queries';
import type { Filters } from '@/lib/filters';

export async function TopComponentsPanel({ filters = {} }: { filters?: Filters }) {
  const data = await getTopComponents(filters);
  return (
    <Panel
      title="Top components"
      description="Most-interacted components. Select one to drill down."
    >
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          <DynamicComponentsChart data={data} />
          <div className="flex flex-wrap gap-2">
            {data.map((row) => (
              <Link
                key={row.component_name}
                href={`/components/${encodeURIComponent(row.component_name)}`}
                className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {row.component_name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
