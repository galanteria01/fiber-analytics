import { Panel, EmptyState } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getRecentEvents } from '@/lib/queries';
import type { Filters } from '@/lib/filters';

const TYPE_BADGE: Record<
  string,
  { variant: 'default' | 'secondary' | 'outline' | 'destructive'; className: string }
> = {
  click: {
    variant: 'secondary',
    className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  },
  view: {
    variant: 'secondary',
    className: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
  },
  state_change: {
    variant: 'secondary',
    className: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  },
  page_view: {
    variant: 'secondary',
    className: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
  },
  submit: {
    variant: 'secondary',
    className: 'bg-pink-500/15 text-pink-600 dark:text-pink-300',
  },
  input: {
    variant: 'secondary',
    className: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300',
  },
  custom: {
    variant: 'secondary',
    className: 'bg-orange-500/15 text-orange-600 dark:text-orange-300',
  },
};

export async function RecentEventsPanel({ filters = {} }: { filters?: Filters }) {
  const events = await getRecentEvents(filters);

  return (
    <Panel title="Recent events" description="Most recent captured interactions.">
      {events.length === 0 ? (
        <EmptyState />
      ) : (
        <ScrollArea className="h-[420px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Path</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event, index) => {
                const badge = TYPE_BADGE[event.event_type];
                return (
                  <TableRow key={`${event.timestamp}-${index}`}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {event.timestamp}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge?.variant ?? 'outline'} className={badge?.className}>
                        {event.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{event.component_name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {event.url_path}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </Panel>
  );
}
