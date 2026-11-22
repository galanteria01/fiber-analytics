import { useCallback, useEffect, useState } from 'react';

interface CapturedEvent {
  id: string;
  event_type: string;
  component_name: string;
  timestamp: string;
}

export function App() {
  const [events, setEvents] = useState<CapturedEvent[]>([]);
  const [clickCount, setClickCount] = useState(0);

  // Listen for FiberAnalytics debug log events so the overlay stays useful even
  // when the dashboard is not running — every captured event is echoed here.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as CapturedEvent | undefined;
      if (detail) {
        console.debug('[fiber-analytics] captured', detail);
        setEvents((prev) => [detail, ...prev].slice(0, 20));
      }
    };
    // The browser SDK emits debug logs to console; we also tap console.debug
    // via a small monkey-patch so the UI overlay can mirror them.
    const originalDebug = console.debug;
    console.debug = (...args: unknown[]) => {
      originalDebug(...args);
      if (typeof args[0] === 'string' && args[0].includes('[fiber-analytics] captured')) {
        const payload = args[1] as CapturedEvent | undefined;
        if (payload && typeof payload === 'object' && 'event_type' in payload) {
          setEvents((prev) => [payload as CapturedEvent, ...prev].slice(0, 20));
        }
      }
    };
    window.addEventListener('fa:captured' as keyof WindowEventMap, handler as EventListener);
    return () => {
      console.debug = originalDebug;
      window.removeEventListener('fa:captured' as keyof WindowEventMap, handler as EventListener);
    };
  }, []);

  const handleClick = useCallback(() => {
    setClickCount((n) => n + 1);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.elements.namedItem('name') as HTMLInputElement;
    console.log('[example] form submitted with:', input.value);
    form.reset();
  }, []);

  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 640,
        margin: '2rem auto',
        padding: '0 1rem',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
        FiberAnalytics — Minimal Vite Example
      </h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        Click the button or submit the form. Auto-tagged events are captured by the browser SDK and
        shown below. Open DevTools → Network to see <code>POST /api/ingest</code> requests.
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={handleClick}
          style={{
            padding: '0.6rem 1.2rem',
            fontSize: '1rem',
            cursor: 'pointer',
            borderRadius: 8,
            border: '1px solid #ccc',
            background: '#f5f5f5',
          }}
        >
          Click me ({clickCount})
        </button>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
        >
          <input
            name="name"
            placeholder="Your name"
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 6,
              border: '1px solid #ccc',
              fontSize: '0.95rem',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0.5rem 0.9rem',
              fontSize: '0.95rem',
              cursor: 'pointer',
              borderRadius: 6,
              border: '1px solid #ccc',
              background: '#eef',
            }}
          >
            Submit
          </button>
        </form>
      </div>

      {/* Debug overlay — mirrors captured events */}
      <div
        style={{
          border: '1px solid #e0e0e0',
          borderRadius: 8,
          padding: '0.75rem 1rem',
          background: '#fafafa',
          minHeight: 80,
          maxHeight: 320,
          overflowY: 'auto',
        }}
      >
        <strong
          style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}
        >
          Captured events {events.length > 0 ? `(${events.length})` : ''}
        </strong>
        {events.length === 0 ? (
          <p style={{ color: '#999', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            No events yet — click the button above. On <code>localhost</code> with{' '}
            <code>debug: true</code> the SDK also renders a floating overlay in the bottom-right
            corner.
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '0.5rem 0 0',
              fontSize: '0.85rem',
              fontFamily: 'monospace',
            }}
          >
            {events.map((ev, i) => (
              <li
                key={`${ev.id ?? i}-${i}`}
                style={{ padding: '0.25rem 0', borderBottom: '1px solid #eee' }}
              >
                <span style={{ color: '#6366f1', fontWeight: 600 }}>{ev.event_type}</span>{' '}
                <span style={{ color: '#333' }}>{ev.component_name}</span>{' '}
                <span style={{ color: '#999' }}>{ev.timestamp}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p style={{ color: '#999', fontSize: '0.8rem', marginTop: '1rem' }}>
        Data flow: <code>Compiler</code> auto-tags this button with <code>data-fa-comp</code> →{' '}
        <code>@fiber-analytics/browser</code> captures the click → queues &amp; flushes to{' '}
        <code>POST /api/ingest</code>. Run <code>pnpm sync</code> to compile into Parquet and view
        in the dashboard.
      </p>
    </div>
  );
}
