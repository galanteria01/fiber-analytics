import type { DeviceClass, EventContext } from '@fiber-analytics/core';

function classifyDevice(width: number): DeviceClass {
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone/i.test(ua) || width < 768) return 'mobile';
  if (/iPad|Tablet/i.test(ua) || width < 1024) return 'tablet';
  return 'desktop';
}

function parseUtm(search: string): Pick<EventContext, 'utm_source' | 'utm_medium' | 'utm_campaign'> {
  try {
    const params = new URLSearchParams(search);
    const out: Pick<EventContext, 'utm_source' | 'utm_medium' | 'utm_campaign'> = {};
    const source = params.get('utm_source');
    const medium = params.get('utm_medium');
    const campaign = params.get('utm_campaign');
    if (source) out.utm_source = source;
    if (medium) out.utm_medium = medium;
    if (campaign) out.utm_campaign = campaign;
    return out;
  } catch {
    return {};
  }
}

/**
 * Captures stable per-page context (locale, device hint, UTM params) once, and
 * provides live viewport dimensions on demand. Attached to every event so the
 * dashboard can segment by device/campaign without extra joins.
 */
export class PageContext {
  private readonly locale: string;
  private readonly utm: Pick<EventContext, 'utm_source' | 'utm_medium' | 'utm_campaign'>;

  constructor() {
    this.locale = navigator.language || 'unknown';
    this.utm = parseUtm(location.search);
  }

  snapshot(): EventContext {
    const viewport_w = window.innerWidth;
    const viewport_h = window.innerHeight;
    return {
      viewport_w,
      viewport_h,
      locale: this.locale,
      device: classifyDevice(viewport_w),
      ...this.utm,
    };
  }
}
