import { useState } from 'react';
import { useRouter } from '../router.js';
import { Modal } from '../components/Modal.js';
import {
  CounterControls,
  LikeButton,
  RatingStars,
  SearchBar,
} from '../components/controls.js';
import { Accordion } from '../components/feedback.js';

export function HomeView() {
  const { navigate } = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="view">
      <header className="hero">
        <h1>Interaction playground</h1>
        <p>
          Every control below is auto-tagged at build time. Interact with them and watch the events
          stream into the FiberAnalytics dashboard.
        </p>
        <div className="row">
          <button
            className="button primary"
            label="cta-shop"
            onClick={() => navigate('/products')}
          >
            Browse products
          </button>
          <button className="button" label="cta-modal" onClick={() => setModalOpen(true)}>
            Open modal
          </button>
        </div>
      </header>

      <section className="grid two">
        <div className="card">
          <h2>Clicks &amp; reactions</h2>
          <CounterControls />
          <LikeButton />
          <RatingStars />
        </div>

        <div className="card">
          <h2>Search</h2>
          <SearchBar />
          <Accordion title="What gets tracked?">
            <p>
              Clicks, submits, input changes, visibility, and SPA page views. Custom events fire via
              the manual <code>track()</code> API.
            </p>
            <button className="button ghost" label="docs-link" onClick={() => navigate('/pricing')}>
              See pricing
            </button>
          </Accordion>
        </div>
      </section>

      {modalOpen ? (
        <Modal title="Upgrade your plan" onClose={() => setModalOpen(false)}>
          <p>Mounting this modal emits a view; closing it emits a state_change.</p>
          <button
            className="button primary"
            label="confirm-upgrade"
            onClick={() => setModalOpen(false)}
          >
            Confirm upgrade
          </button>
        </Modal>
      ) : null}
    </div>
  );
}
