import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsentManager, hasOptOutSignal } from './consent.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubNavigator(nav: Record<string, unknown>): void {
  vi.stubGlobal('navigator', nav);
  vi.stubGlobal('window', {});
}

describe('consent', () => {
  it('detects Global Privacy Control', () => {
    stubNavigator({ globalPrivacyControl: true });
    expect(hasOptOutSignal()).toBe(true);
  });

  it('detects Do-Not-Track', () => {
    stubNavigator({ doNotTrack: '1' });
    expect(hasOptOutSignal()).toBe(true);
  });

  it('returns false with no signal', () => {
    stubNavigator({ doNotTrack: '0' });
    expect(hasOptOutSignal()).toBe(false);
  });

  it('forces consent off when respectDnt and a signal is present', () => {
    stubNavigator({ globalPrivacyControl: true });
    const mgr = new ConsentManager(true, true);
    expect(mgr.isGranted).toBe(false);
  });

  it('honors the initial value when no signal and respectDnt off', () => {
    stubNavigator({});
    expect(new ConsentManager(false, false).isGranted).toBe(false);
    const mgr = new ConsentManager(true, false);
    expect(mgr.isGranted).toBe(true);
    mgr.set(false);
    expect(mgr.isGranted).toBe(false);
  });
});
