import { TAGGED_SELECTOR, type ClientEvent } from '@fiber-analytics/core';
import { createEvent } from './event-factory.js';

type Emit = (event: ClientEvent) => void;

/**
 * Resolves the nearest tagged ancestor of an event target, or null.
 */
function findTagged(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  return target.closest(TAGGED_SELECTOR);
}

/**
 * Binds a single delegated `click` and `change` listener to the document. This
 * is far cheaper than per-element handlers and automatically covers elements
 * added later. Returns a teardown function.
 */
export function bindInterceptors(emit: Emit): () => void {
  const onClick = (event: MouseEvent): void => {
    const element = findTagged(event.target);
    if (!element) return;
    emit(createEvent(element, 'click'));
  };

  const onChange = (event: Event): void => {
    const element = findTagged(event.target);
    if (!element) return;
    emit(createEvent(element, 'state_change'));
  };

  // Listeners are passive: the SDK never calls preventDefault.
  const options: AddEventListenerOptions = { capture: true, passive: true };
  document.addEventListener('click', onClick, options);
  document.addEventListener('change', onChange, options);

  return () => {
    document.removeEventListener('click', onClick, options);
    document.removeEventListener('change', onChange, options);
  };
}
