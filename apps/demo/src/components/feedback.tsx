import { useState, type ReactNode } from 'react';
import { setConsent, track } from '@fiber-analytics/browser';
import { useToast } from '../toast.js';

/**
 * Expand/collapse section. The body (which contains an interactive button) is
 * conditionally mounted, so the SDK records `view` on expand and
 * `state_change` (visible:false) on collapse.
 */
export function Accordion({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="accordion">
      <button
        className="accordion-trigger"
        label="accordion-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{title}</span>
        <span className="chevron">{open ? '-' : '+'}</span>
      </button>
      {open ? <div className="accordion-body">{children}</div> : null}
    </div>
  );
}

/**
 * Consent banner wired to the SDK's runtime consent API. Mounts on first load
 * (a `view`) and unmounts once the user responds (a `state_change`).
 */
export function ConsentBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { notify } = useToast();

  if (dismissed) return null;

  const respond = (granted: boolean) => {
    setConsent(granted);
    track('consent_response', { granted });
    setDismissed(true);
    notify(granted ? 'Analytics enabled' : 'Analytics paused');
  };

  return (
    <div className="consent" role="dialog" aria-label="Cookie consent">
      <p>We capture anonymized interaction analytics to improve this demo.</p>
      <div className="row">
        <button className="button ghost" label="consent-decline" onClick={() => respond(false)}>
          Decline
        </button>
        <button className="button primary" label="consent-accept" onClick={() => respond(true)}>
          Accept
        </button>
      </div>
    </div>
  );
}
