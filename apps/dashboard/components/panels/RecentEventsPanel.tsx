import { Panel, EmptyState } from '@/components/ui/Panel';
import { getRecentEvents } from '@/lib/queries';

const TYPE_BADGE: Record<string, string> = {
  click: 'bg-emerald-500/15 text-emerald-300',
  view: 'bg-blue-500/15 text-blue-300',
  state_change: 'bg-amber-500/15 text-amber-300',
};

export async function RecentEventsPanel() {
  const events = await getRecentEvents();

  return (
    <Panel title="Recent events" description="Most recent captured interactions.">
      {events.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-gray-400">
              <tr className="border-b border-white/10">
                <th className="py-2 pr-4 font-medium">Time</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Component</th>
                <th className="py-2 font-medium">Path</th>
              </tr>
            </thead>
            <tbody className="text-gray-200">
              {events.map((event, index) => (
                <tr key={`${event.timestamp}-${index}`} className="border-b border-white/5">
                  <td className="py-2 pr-4 font-mono text-gray-400">{event.timestamp}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded px-2 py-0.5 ${TYPE_BADGE[event.event_type] ?? 'bg-white/10 text-gray-300'}`}
                    >
                      {event.event_type}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{event.component_name}</td>
                  <td className="py-2 font-mono text-gray-400">{event.url_path}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
