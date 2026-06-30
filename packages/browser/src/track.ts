import type { ClientEvent } from '@fiber-analytics/core';
import { createCustomEvent, createPageViewEvent, type Enricher } from './event-factory.js';

interface ManualEmitter {
  enricher: Enricher;
  emit: (event: ClientEvent) => void;
}

// Set by `init()`; null when the SDK is not running.
let active: ManualEmitter | null = null;

/** Wires the manual API to the running tracker. Internal. */
export function registerManual(emitter: ManualEmitter | null): void {
  active = emitter;
}

/**
 * Emits a custom event. No-op (events are dropped) when the SDK is not
 * initialized or consent has not been granted. Props are safelisted to
 * primitives.
 */
export function track(name: string, props?: Record<string, unknown>): void {
  if (!active) return;
  active.emit(createCustomEvent(active.enricher, name, props));
}

/** Manually emits a `page_view` for the current navigation state. */
export function page(): void {
  if (!active) return;
  active.emit(createPageViewEvent(active.enricher));
}
