import { TAGGED_SELECTOR, type ClientEvent } from '@fiber-analytics/core';
import { createElementEvent, type Enricher } from './event-factory.js';

type Emit = (event: ClientEvent) => void;

const INPUT_DEBOUNCE_MS = 500;

function findTagged(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  return target.closest(TAGGED_SELECTOR);
}

/** Captures the value length (never the value itself) for text-like inputs. */
function inputMeta(element: Element): Record<string, number> | undefined {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return { value_length: element.value.length };
  }
  return undefined;
}

/**
 * Binds delegated listeners for the full interaction set (`click`, `submit`,
 * `change`, debounced `input`, and keyboard activation of `role="button"`
 * elements). Delegation keeps cost O(1) and covers dynamically added nodes.
 * Returns a teardown function.
 */
export function bindInterceptors(enricher: Enricher, emit: Emit): () => void {
  const debounceTimers = new Map<Element, ReturnType<typeof setTimeout>>();

  const onClick = (event: MouseEvent): void => {
    const element = findTagged(event.target);
    if (element) emit(createElementEvent(element, 'click', enricher));
  };

  const onSubmit = (event: Event): void => {
    const element = findTagged(event.target);
    if (element) emit(createElementEvent(element, 'submit', enricher));
  };

  const onChange = (event: Event): void => {
    const element = findTagged(event.target);
    if (element) emit(createElementEvent(element, 'state_change', enricher, inputMeta(element)));
  };

  const onInput = (event: Event): void => {
    const element = findTagged(event.target);
    if (!element) return;
    const existing = debounceTimers.get(element);
    if (existing) clearTimeout(existing);
    debounceTimers.set(
      element,
      setTimeout(() => {
        debounceTimers.delete(element);
        emit(createElementEvent(element, 'input', enricher, inputMeta(element)));
      }, INPUT_DEBOUNCE_MS),
    );
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const element = findTagged(event.target);
    if (!element) return;
    const role = element.getAttribute('role');
    // Native buttons/links already emit click; only synthesize for ARIA buttons.
    if (role === 'button') emit(createElementEvent(element, 'click', enricher));
  };

  const options: AddEventListenerOptions = { capture: true, passive: true };
  document.addEventListener('click', onClick, options);
  document.addEventListener('submit', onSubmit, options);
  document.addEventListener('change', onChange, options);
  document.addEventListener('input', onInput, options);
  document.addEventListener('keydown', onKeyDown, options);

  return () => {
    document.removeEventListener('click', onClick, options);
    document.removeEventListener('submit', onSubmit, options);
    document.removeEventListener('change', onChange, options);
    document.removeEventListener('input', onInput, options);
    document.removeEventListener('keydown', onKeyDown, options);
    for (const timer of debounceTimers.values()) clearTimeout(timer);
    debounceTimers.clear();
  };
}
