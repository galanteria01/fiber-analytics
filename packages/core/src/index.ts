export {
  COMP_ATTR,
  PROPS_ATTR,
  TAGGED_SELECTOR,
  INTERACTIVE_TAGS,
  INTERACTIVE_HANDLERS,
} from './constants.js';

export {
  EVENT_COLUMNS,
  type AnalyticsEvent,
  type ClientEvent,
  type EventType,
  type EventProperties,
  type PrimitiveValue,
} from './schema.js';

export { type FiberAnalyticsConfig, type IngestPayload } from './types.js';

export { isSafePrimitive, safelistProps, parsePropsAttr } from './safelist.js';

export { validateIngestPayload } from './validate.js';
