export {
  COMP_ATTR,
  PROPS_ATTR,
  LOC_ATTR,
  IGNORE_ATTR,
  TAGGED_SELECTOR,
  INTERACTIVE_TAGS,
  INTERACTIVE_HANDLERS,
  SENSITIVE_PROP_PATTERNS,
} from './constants.js';

export {
  SCHEMA_VERSION,
  EVENT_COLUMNS,
  type AnalyticsEvent,
  type ClientEvent,
  type EventContext,
  type EventType,
  type EventProperties,
  type PrimitiveValue,
  type DeviceClass,
} from './schema.js';

export { type FiberAnalyticsConfig, type IngestPayload } from './types.js';

export { isSafePrimitive, isSensitiveKey, safelistProps, parsePropsAttr } from './safelist.js';

export { clampTimestamp, MAX_FUTURE_MS, MAX_PAST_MS } from './time.js';

export { validateIngestPayload, MAX_EVENTS_PER_BATCH } from './validate.js';
