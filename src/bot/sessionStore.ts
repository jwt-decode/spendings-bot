export type SessionStep = "awaitingCategory" | "awaitingSubcategory";

export interface SessionState {
  step: SessionStep;
  amount: number;
  category?: string;
  rawMessage: string;
  messageId: number;
  chatId: number;
  createdAt: number;
}

export class SessionStore {
  private sessions = new Map<string, SessionState>();

  constructor(private ttlMs = 10 * 60 * 1000) {}

  get(key: string): SessionState | null {
    const session = this.sessions.get(key);
    if (!session) {
      return null;
    }
    if (Date.now() - session.createdAt > this.ttlMs) {
      this.sessions.delete(key);
      return null;
    }
    return session;
  }

  set(key: string, state: SessionState): void {
    this.sessions.set(key, state);
  }

  clear(key: string): void {
    this.sessions.delete(key);
  }
}
