import {
  COMP_ATTR,
  PROPS_ATTR,
  LOC_ATTR,
  SCHEMA_VERSION,
  parsePropsAttr,
  safelistProps,
  type ClientEvent,
  type EventContext,
  type EventProperties,
  type EventType,
} from '@fiber-analytics/core';
import type { PageView } from './navigation.js';

/**
 * Provides the cross-cutting fields (session, pageview, ordering, context) that
 * every event shares. Implemented by the tracker in `index.ts`.
 */
export interface Enricher {
  readonly sessionId: string;
  readonly pageview: PageView;
  context(): EventContext;
  nextSeq(): number;
}

function randomId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function base(enricher: Enricher, eventType: EventType): ClientEvent {
  const pv = enricher.pageview;
  return {
    schema_version: SCHEMA_VERSION,
    event_id: randomId(),
    session_id: enricher.sessionId,
    pageview_id: pv.id,
    seq: enricher.nextSeq(),
    occurred_at: new Date().toISOString(),
    event_type: eventType,
    component_name: '',
    properties: {},
    url_path: pv.path,
    referrer: pv.referrer || undefined,
    page_title: pv.title || undefined,
    ...enricher.context(),
  };
}

/**
 * Builds a normalized client event from a tagged DOM element, reading the
 * component name, safelisted props, and source location injected by the
 * compiler plugin. Additional runtime props (e.g. input value length) may be
 * merged in via `extra`.
 */
export function createElementEvent(
  element: Element,
  eventType: EventType,
  enricher: Enricher,
  extra?: EventProperties,
): ClientEvent {
  const event = base(enricher, eventType);
  event.component_name = element.getAttribute(COMP_ATTR) ?? 'Anonymous';
  event.properties = { ...parsePropsAttr(element.getAttribute(PROPS_ATTR)), ...(extra ?? {}) };
  const loc = element.getAttribute(LOC_ATTR);
  if (loc) event.source_loc = loc;
  return event;
}

/** Builds a `page_view` event for the current navigation. */
export function createPageViewEvent(enricher: Enricher): ClientEvent {
  return base(enricher, 'page_view');
}

/** Builds a manual/custom event (`track()`). */
export function createCustomEvent(
  enricher: Enricher,
  name: string,
  props?: Record<string, unknown>,
): ClientEvent {
  const event = base(enricher, 'custom');
  event.event_name = name;
  event.component_name = name;
  if (props) event.properties = safelistProps(props);
  return event;
}
