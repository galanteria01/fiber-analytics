import type { ReactNode } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface PanelProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Panel({
  title,
  description,
  action,
  className,
  children,
}: PanelProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-sm">{title}</CardTitle>
          {description ? (
            <CardDescription className="text-xs">{description}</CardDescription>
          ) : null}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function PanelSkeleton({ title }: { title: string }) {
  return (
    <Panel title={title}>
      <Skeleton className="h-40 w-full" />
    </Panel>
  );
}

export function EmptyState() {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
      <p className="font-medium text-foreground">No data yet</p>
      <p>
        Interact with the demo app, then run{' '}
        <code className="rounded bg-muted px-1 py-0.5 text-foreground">
          pnpm sync
        </code>
        .
      </p>
    </div>
  );
}
