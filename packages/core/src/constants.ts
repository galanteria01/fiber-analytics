/**
 * HTML data attribute that carries the extracted component name, injected by
 * the compiler plugin and read by the browser SDK via event delegation.
 */
export const COMP_ATTR = 'data-fa-comp';

/**
 * HTML data attribute that carries a JSON-encoded safelist of primitive props.
 */
export const PROPS_ATTR = 'data-fa-props';

/**
 * HTML data attribute that carries the build-time source location
 * (`file:line:col`) of the tagged element, for trace-to-source readability.
 */
export const LOC_ATTR = 'data-fa-loc';

/**
 * Presence of this attribute opts an element (and its tagging) out entirely.
 */
export const IGNORE_ATTR = 'data-fa-ignore';

/**
 * CSS selector matching any element tagged by the compiler plugin.
 */
export const TAGGED_SELECTOR = `[${COMP_ATTR}]`;

/**
 * Default native HTML tags considered interactive for auto-tagging.
 */
export const INTERACTIVE_TAGS = new Set([
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'summary',
]);

/**
 * Default event handler prop names that mark a JSX element as interactive.
 */
export const INTERACTIVE_HANDLERS = new Set([
  'onClick',
  'onChange',
  'onInput',
  'onSubmit',
  'onKeyDown',
  'onToggle',
]);

/**
 * Property names that must never be captured, even when they are static
 * primitives, to avoid leaking PII or secrets. Matched as case-insensitive
 * substrings of the prop name.
 */
export const SENSITIVE_PROP_PATTERNS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'auth',
  'ssn',
  'creditcard',
  'credit_card',
  'cardnumber',
  'card_number',
  'cvv',
  'email',
  'phone',
] as const;
