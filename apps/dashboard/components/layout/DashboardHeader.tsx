import Link from 'next/link';
import { Activity } from 'lucide-react';

import { RefreshButton } from '@/components/RefreshButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MainNav } from '@/components/layout/MainNav';
import { SignOutButton } from '@/components/SignOutButton';

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <p className="hidden text-sm font-semibold tracking-tight sm:block">FiberAnalytics</p>
          </Link>
          <MainNav />
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton />
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
