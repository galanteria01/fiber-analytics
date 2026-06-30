import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Mounting/unmounting this component is what the SDK's state tracker observes
 * to emit `view` / `state_change` (visible:false) events.
 */
export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            x
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
