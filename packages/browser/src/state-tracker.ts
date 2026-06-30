import { TAGGED_SELECTOR, COMP_ATTR, type ClientEvent } from '@fiber-analytics/core';
import { createEvent } from './event-factory.js';

type Emit = (event: ClientEvent) => void;

/**
 * Yields every tagged element within (and including) a node.
 */
function* taggedWithin(node: Node): Generator<Element> {
  if (!(node instanceof Element)) return;
  if (node.matches(TAGGED_SELECTOR)) yield node;
  const descendants = node.querySelectorAll(TAGGED_SELECTOR);
  for (const el of descendants) yield el;
}

/**
 * Tracks component visibility as a lightweight state machine using a
 * `MutationObserver`. Mounting a tagged element (e.g. a modal opening) emits a
 * `view`; unmounting emits a `state_change` with `{ visible: false }`. This
 * captures semantic state transitions as discrete JSON chunks rather than
 * recording continuous DOM mutations.
 *
 * Returns a teardown function.
 */
export function trackState(emit: Emit): () => void {
  // Emit an initial view for elements already present at startup.
  for (const el of document.querySelectorAll(TAGGED_SELECTOR)) {
    emit(createEvent(el, 'view'));
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        for (const el of taggedWithin(node)) emit(createEvent(el, 'view'));
      }
      for (const node of mutation.removedNodes) {
        for (const el of taggedWithin(node)) {
          const event = createEvent(el, 'state_change');
          event.properties = { ...event.properties, visible: false };
          emit(event);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributeFilter: [COMP_ATTR],
  });

  return () => observer.disconnect();
}
