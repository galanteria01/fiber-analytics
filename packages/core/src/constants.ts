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
 * CSS selector matching any element tagged by the compiler plugin.
 */
export const TAGGED_SELECTOR = `[${COMP_ATTR}]`;

/**
 * Native HTML tags that are always considered interactive for auto-tagging.
 */
export const INTERACTIVE_TAGS = new Set(['button', 'a']);

/**
 * Event handler prop names that mark a JSX element as interactive.
 */
export const INTERACTIVE_HANDLERS = new Set(['onClick', 'onChange']);
