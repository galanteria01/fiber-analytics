import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

interface ToastItem {
  id: number;
  message: string;
  tone: 'info' | 'success';
}

interface ToastValue {
  notify: (message: string, tone?: ToastItem['tone']) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

/**
 * Lightweight transient toasts. Each toast contains an interactive dismiss
 * button, so its mount/unmount is captured by the SDK's visibility tracker as
 * a `view` / `state_change` pair.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((message: string, tone: ToastItem['tone'] = 'info') => {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), message, tone }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="toast-host" aria-live="polite">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3200);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className={`toast toast-${toast.tone}`} role="status">
      <span>{toast.message}</span>
      <button className="icon-button" aria-label="Dismiss notification" onClick={onDismiss}>
        x
      </button>
    </div>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
