/**
 * Reads the browser's Do-Not-Track / Global Privacy Control signals. Returns
 * true when the user has expressed an opt-out preference.
 */
export function hasOptOutSignal(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string };
  if (nav.globalPrivacyControl === true) return true;
  const dnt =
    nav.doNotTrack ??
    (window as Window & { doNotTrack?: string }).doNotTrack ??
    (nav as Navigator & { msDoNotTrack?: string }).msDoNotTrack;
  return dnt === '1' || dnt === 'yes';
}

/**
 * Tracks the user's consent state. When `respectDnt` is enabled, a browser
 * opt-out signal forces consent off regardless of the configured default.
 */
export class ConsentManager {
  private granted: boolean;

  constructor(initial: boolean, respectDnt: boolean) {
    this.granted = initial && !(respectDnt && hasOptOutSignal());
  }

  get isGranted(): boolean {
    return this.granted;
  }

  set(value: boolean): void {
    this.granted = value;
  }
}
