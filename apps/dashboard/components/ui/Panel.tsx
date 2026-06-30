import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function Panel({ title, description, children }: PanelProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-panel p-5">
      <header className="mb-4">
        <h2 className="text-sm font-semibold text-gray-100">{title}</h2>
        {description ? <p className="mt-1 text-xs text-gray-400">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function PanelSkeleton({ title }: { title: string }) {
  return (
    <Panel title={title}>
      <div className="h-40 animate-pulse rounded-lg bg-white/5" />
    </Panel>
  );
}

export function EmptyState() {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-1 text-center text-xs text-gray-400">
      <p className="font-medium text-gray-300">No data yet</p>
      <p>
        Interact with the demo app, then run <code className="text-gray-200">pnpm sync</code>.
      </p>
    </div>
  );
}
