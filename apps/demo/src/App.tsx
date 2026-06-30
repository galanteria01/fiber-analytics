import { useState } from 'react';
import { Modal } from './components/Modal.js';
import { SignupForm } from './components/SignupForm.js';

export function App() {
  const [count, setCount] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main className="app">
      <header className="hero">
        <h1>FiberAnalytics Demo</h1>
        <p>
          Every interactive element below was auto-tagged at build time. Open the overlay (bottom
          right) and watch events stream as you interact.
        </p>
      </header>

      <section className="panel">
        <h2>Clicks</h2>
        <div className="row">
          <button className="button" label="increment" onClick={() => setCount((c) => c + 1)}>
            Increment ({count})
          </button>
          <button className="button" label="reset" onClick={() => setCount(0)}>
            Reset
          </button>
          <a className="link" href="#docs" label="docs-link">
            Read the docs
          </a>
        </div>
      </section>

      <section className="panel">
        <h2>Form state changes</h2>
        <SignupForm />
      </section>

      <section className="panel">
        <h2>Visibility state</h2>
        <button className="button primary" label="open-modal" onClick={() => setModalOpen(true)}>
          Open modal
        </button>
      </section>

      {modalOpen ? (
        <Modal title="Upgrade your plan" onClose={() => setModalOpen(false)}>
          <p>Mounting this modal emits a view; closing it emits a state_change.</p>
          <button className="button primary" label="confirm-upgrade" onClick={() => setModalOpen(false)}>
            Confirm upgrade
          </button>
        </Modal>
      ) : null}
    </main>
  );
}
