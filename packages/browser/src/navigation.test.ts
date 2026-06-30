import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NavigationTracker, type PageView } from './navigation.js';

const popHandlers = new Set<() => void>();

beforeEach(() => {
  const location = { href: 'http://x/a', origin: 'http://x', pathname: '/a' };
  vi.stubGlobal('location', location);
  vi.stubGlobal('document', { referrer: 'http://ref', title: 'Page A' });
  vi.stubGlobal('history', {
    pushState: vi.fn(),
    replaceState: vi.fn(),
  });
  vi.stubGlobal('window', {
    addEventListener: (type: string, cb: () => void) => {
      if (type === 'popstate') popHandlers.add(cb);
    },
    removeEventListener: (_type: string, cb: () => void) => popHandlers.delete(cb),
  });
});

afterEach(() => {
  popHandlers.clear();
  vi.unstubAllGlobals();
});

describe('NavigationTracker', () => {
  it('emits an initial page view on start', () => {
    const seen: PageView[] = [];
    const nav = new NavigationTracker((pv) => seen.push(pv));
    nav.start();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.path).toBe('/a');
    expect(seen[0]?.referrer).toBe('http://ref');
    nav.teardown();
  });

  it('emits a new page view with a fresh id on pushState navigation', () => {
    const seen: PageView[] = [];
    const nav = new NavigationTracker((pv) => seen.push(pv));
    nav.start();

    (location as unknown as { href: string }).href = 'http://x/b';
    history.pushState({}, '', '/b');

    expect(seen).toHaveLength(2);
    expect(seen[1]?.path).toBe('/b');
    expect(seen[1]?.referrer).toBe('http://x/a');
    expect(seen[1]?.id).not.toBe(seen[0]?.id);
    nav.teardown();
  });
});
