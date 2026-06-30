import { Panel, EmptyState } from '@/components/ui/Panel';
import { getFunnel } from '@/lib/queries';

/**
 * A lightweight session funnel rendered as server-side CSS bars (no charting
 * dependency needed). Each step shows the number of distinct sessions reaching
 * it, relative to the first step.
 */
export async function FunnelPanel() {
  const steps = await getFunnel();
  const top = steps[0]?.sessions ?? 0;

  return (
    <Panel title="Session funnel" description="Distinct sessions reaching each stage.">
      {top === 0 ? (
        <EmptyState />
      ) : (
        <ol className="flex flex-col gap-3">
          {steps.map((step) => {
            const pct = top > 0 ? Math.round((step.sessions / top) * 100) : 0;
            return (
              <li key={step.label}>
                <div className="mb-1 flex items-center justify-between text-xs text-gray-300">
                  <span>{step.label}</span>
                  <span className="text-gray-400">
                    {step.sessions.toLocaleString()} ({pct}%)
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-indigo-500"
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
