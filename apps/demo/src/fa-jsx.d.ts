import 'react';

/**
 * The FiberAnalytics compiler plugin captures static primitive attributes into
 * `data-fa-props`. The demo uses a non-standard `label` attribute purely as
 * instrumentation metadata, so we widen React's attribute types to permit it on
 * any element.
 */
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface HTMLAttributes<T> {
    label?: string;
  }
}
