const STORAGE_KEY = 'fa_session';
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

interface SessionState {
  id: string;
  seq: number;
  lastActivity: number;
}

function randomId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

/**
 * Manages an ephemeral, cookieless client session identifier with a sliding
 * inactivity window. The id lives in `sessionStorage` (per-tab) and is reset
 * after `timeoutMs` of inactivity. A monotonic `seq` provides deterministic
 * intra-session event ordering, surviving out-of-order network delivery.
 *
 * No PII is stored; the id is a random UUID scoped to the tab session.
 */
export class SessionManager {
  private state: SessionState;

  constructor(private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.state = this.load() ?? this.mint();
    this.refresh();
  }

  private mint(): SessionState {
    return { id: randomId(), seq: 0, lastActivity: Date.now() };
  }

  private load(): SessionState | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<SessionState>;
      if (typeof parsed.id !== 'string' || typeof parsed.seq !== 'number') return null;
      return {
        id: parsed.id,
        seq: parsed.seq,
        lastActivity: typeof parsed.lastActivity === 'number' ? parsed.lastActivity : Date.now(),
      };
    } catch {
      return null;
    }
  }

  private persist(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // storage may be unavailable (private mode); keep in-memory state.
    }
  }

  /** Rotates the session id if the inactivity window has elapsed. */
  private refresh(): void {
    const now = Date.now();
    if (now - this.state.lastActivity > this.timeoutMs) {
      this.state = this.mint();
    }
    this.state.lastActivity = now;
    this.persist();
  }

  get sessionId(): string {
    this.refresh();
    return this.state.id;
  }

  /** Returns the next monotonic sequence number for this session. */
  nextSeq(): number {
    this.refresh();
    this.state.seq += 1;
    this.persist();
    return this.state.seq;
  }
}
