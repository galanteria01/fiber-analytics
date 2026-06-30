import { getSummary } from '@/lib/queries';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-panel p-5">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-50">{value.toLocaleString()}</div>
    </div>
  );
}

export async function SummaryPanel() {
  const summary = await getSummary();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Stat label="Total events" value={summary.total_events} />
      <Stat label="Sessions" value={summary.sessions} />
      <Stat label="Components" value={summary.components} />
    </div>
  );
}
