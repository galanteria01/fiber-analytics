import { TAGGED_SELECTOR, COMP_ATTR, type ClientEvent } from '@fiber-analytics/core';
import { createElementEvent, type Enricher } from './event-factory.js';

type Emit = (event: ClientEvent) => void;

/** Cap the initial view burst so a large first paint never floods the queue. */
const MAX_INITIAL_VIEWS = 30;

function* taggedWithin(node: Node): Generator<Element> {
  if (!(node instanceof Element)) return;
  if (node.matches(TAGGED_SELECTOR)) yield node;
  for (const el of node.querySelectorAll(TAGGED_SELECTOR)) yield el;
}

/**
 * Tracks component visibility as a state machine via `MutationObserver`.
 * Mounting a tagged element emits a `view`; unmounting emits a `state_change`
 * with `{ visible: false }`. The initial on-load burst is capped to avoid
 * flooding the queue on content-heavy pages. Returns a teardown function.
 */
export function trackState(enricher: Enricher, emit: Emit): () => void {
  const initial = document.querySelectorAll(TAGGED_SELECTOR);
  const limit = Math.min(initial.length, MAX_INITIAL_VIEWS);
  for (let i = 0; i < limit; i += 1) {
    const el = initial[i];
    if (el) emit(createElementEvent(el, 'view', enricher));
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        for (const el of taggedWithin(node)) emit(createElementEvent(el, 'view', enricher));
      }
      for (const node of mutation.removedNodes) {
        for (const el of taggedWithin(node)) {
          emit(createElementEvent(el, 'state_change', enricher, { visible: false }));
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [COMP_ATTR],
  });

  return () => observer.disconnect();
}
