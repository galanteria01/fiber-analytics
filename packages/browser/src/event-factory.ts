import {
  COMP_ATTR,
  PROPS_ATTR,
  parsePropsAttr,
  type ClientEvent,
  type EventType,
} from '@fiber-analytics/core';

/**
 * Builds a normalized client event from a tagged DOM element. Reads the
 * component name and safelisted props injected by the compiler plugin.
 */
export function createEvent(element: Element, eventType: EventType): ClientEvent {
  const componentName = element.getAttribute(COMP_ATTR) ?? 'Anonymous';
  const properties = parsePropsAttr(element.getAttribute(PROPS_ATTR));

  return {
    event_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    event_type: eventType,
    component_name: componentName,
    properties,
    url_path: location.pathname,
  };
}
