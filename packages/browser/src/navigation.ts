export interface PageView {
  id: string;
  url: string;
  path: string;
  title: string;
  referrer: string;
}

function randomId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

type HistoryFn = (data: unknown, unused: string, url?: string | URL | null) => void;

/**
 * Tracks SPA navigation by patching the History API (`pushState`/`replaceState`)
 * and listening for `popstate` + `hashchange`. Each navigation mints a fresh
 * `pageview_id` and emits a `page_view`, capturing the correct
 * url/title/referrer at navigation time.
 */
export class NavigationTracker {
  private current: PageView;
  private origPush: HistoryFn | null = null;
  private origReplace: HistoryFn | null = null;
  private readonly onPopState = (): void => this.handleChange();
  private readonly onHashChange = (): void => this.handleChange();

  constructor(private readonly onPageView: (pv: PageView) => void) {
    this.current = this.mint(location.href, document.referrer);
  }

  private mint(url: string, referrer: string): PageView {
    const u = new URL(url, location.origin);
    return { id: randomId(), url, path: u.pathname, title: document.title, referrer };
  }

  get pageview(): PageView {
    return this.current;
  }

  private handleChange(): void {
    if (location.href === this.current.url) return;
    const referrer = this.current.url;
    this.current = this.mint(location.href, referrer);
    this.onPageView(this.current);
  }

  /** Patches history, binds listeners, and emits the initial page view. */
  start(): void {
    this.origPush = history.pushState.bind(history);
    this.origReplace = history.replaceState.bind(history);

    history.pushState = (data, unused, url) => {
      this.origPush?.(data, unused, url);
      this.handleChange();
    };
    history.replaceState = (data, unused, url) => {
      this.origReplace?.(data, unused, url);
      this.handleChange();
    };
    window.addEventListener('popstate', this.onPopState);
    window.addEventListener('hashchange', this.onHashChange);

    this.onPageView(this.current);
  }

  teardown(): void {
    if (this.origPush) history.pushState = this.origPush;
    if (this.origReplace) history.replaceState = this.origReplace;
    window.removeEventListener('popstate', this.onPopState);
    window.removeEventListener('hashchange', this.onHashChange);
  }
}
