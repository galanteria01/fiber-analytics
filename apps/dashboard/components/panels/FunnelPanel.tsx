import { Panel, EmptyState } from '@/components/ui/Panel';
import { getFunnel } from '@/lib/queries';
import type { Filters } from '@/lib/filters';

/**
 * A lightweight session funnel rendered as server-side bars (no charting
 * dependency needed). Each step shows the number of distinct sessions reaching
 * it, relative to the first step.
 */
export async function FunnelPanel({ filters = {} }: { filters?: Filters }) {
  const steps = await getFunnel(filters);
  const top = steps[0]?.sessions ?? 0;

  return (
    <Panel
      title="Session funnel"
      description="Distinct sessions reaching each stage."
    >
      {top === 0 ? (
        <EmptyState />
      ) : (
        <ol className="flex flex-col gap-4">
          {steps.map((step, index) => {
            const pct = top > 0 ? Math.round((step.sessions / top) * 100) : 0;
            return (
              <li key={step.label}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                      {index + 1}
                    </span>
                    {step.label}
                  </span>
                  <span className="text-muted-foreground">
                    {step.sessions.toLocaleString()}{' '}
                    <span className="tabular-nums">({pct}%)</span>
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
