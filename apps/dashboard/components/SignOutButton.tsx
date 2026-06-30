'use client';

import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  async function signOut(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }
  return (
    <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
      <LogOut className="h-4 w-4" />
    </Button>
  );
}
