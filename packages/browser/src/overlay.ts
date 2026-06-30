import type { ClientEvent, EventType } from '@fiber-analytics/core';

const MAX_ROWS = 50;

const TYPE_COLORS: Record<EventType, string> = {
  click: '#34d399',
  view: '#60a5fa',
  state_change: '#fbbf24',
  page_view: '#a78bfa',
  submit: '#f472b6',
  input: '#22d3ee',
  custom: '#f59e0b',
};

/**
 * Returns true when running on a local development host.
 */
export function isLocalhost(): boolean {
  const host = location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

export interface Overlay {
  record(event: ClientEvent): void;
  destroy(): void;
}

/**
 * Renders a small fixed-position panel listing captured events live, for
 * verifying instrumentation during local development.
 */
export function createOverlay(): Overlay {
  const root = document.createElement('div');
  root.setAttribute('data-fa-overlay', '');
  Object.assign(root.style, {
    position: 'fixed',
    bottom: '12px',
    right: '12px',
    width: '320px',
    maxHeight: '40vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(17, 24, 39, 0.94)',
    color: '#e5e7eb',
    font: '12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
    borderRadius: '10px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
    zIndex: '2147483647',
  } satisfies Partial<CSSStyleDeclaration>);

  const header = document.createElement('div');
  header.textContent = 'FiberAnalytics - captured events';
  Object.assign(header.style, {
    padding: '8px 10px',
    fontWeight: '600',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    flex: '0 0 auto',
  } satisfies Partial<CSSStyleDeclaration>);

  const list = document.createElement('div');
  Object.assign(list.style, {
    padding: '6px 10px',
    overflowY: 'auto',
    flex: '1 1 auto',
  } satisfies Partial<CSSStyleDeclaration>);

  root.append(header, list);
  document.body.appendChild(root);

  return {
    record(event) {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex',
        gap: '6px',
        padding: '2px 0',
        whiteSpace: 'nowrap',
      } satisfies Partial<CSSStyleDeclaration>);

      const badge = document.createElement('span');
      badge.textContent = event.event_type;
      Object.assign(badge.style, {
        color: TYPE_COLORS[event.event_type],
        fontWeight: '600',
      } satisfies Partial<CSSStyleDeclaration>);

      const label = document.createElement('span');
      label.textContent = event.component_name;
      label.style.color = '#f9fafb';

      row.append(badge, label);
      list.prepend(row);

      while (list.childElementCount > MAX_ROWS) {
        list.lastElementChild?.remove();
      }
    },
    destroy() {
      root.remove();
    },
  };
}
