import { Activity, Boxes, FileText, Users, type LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { getSummary } from '@/lib/queries';
import type { Filters } from '@/lib/filters';

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-6">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-3xl font-semibold tracking-tight">{value.toLocaleString()}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export async function SummaryPanel({ filters = {} }: { filters?: Filters }) {
  const summary = await getSummary(filters);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <Stat label="Total events" value={summary.total_events} icon={Activity} />
      <Stat label="Sessions" value={summary.sessions} icon={Users} />
      <Stat label="Page views" value={summary.pageviews} icon={FileText} />
      <Stat label="Components" value={summary.components} icon={Boxes} />
    </div>
  );
}
