import { DEFAULT_MAX_CONTEXT_BYTES, DEFAULT_MAX_CONTEXT_TURNS, MAX_SESSIONS, SESSION_TTL_MS } from '../common';
import type { SessionRecord, SessionTurn } from '../common';
import { capTurnsByBytes, cloneRecord, formatTurns, toSessionKey } from '../utils/session-store.util';

type SessionStoreEntry = {
  id: string;
  provider: string;
  turns: SessionTurn[];
  createdAt: string;
  lastAccessedAt: string;
  nativeSessionId?: string;
};

type ContextBudget = Readonly<{
  maxContextTurns?: number;
  maxContextBytes?: number;
}>;

export class InMemorySessionStore {
  private readonly entries = new Map<string, SessionStoreEntry>();

  private readonly locks = new Set<string>();

  public createOrGet(provider: string, id: string): SessionRecord {
    this.cleanupExpired();

    const key = toSessionKey(provider, id);
    const now = new Date().toISOString();
    const existing = this.entries.get(key);

    if (existing) {
      existing.lastAccessedAt = now;
      this.entries.delete(key);
      this.entries.set(key, existing);

      return cloneRecord(existing);
    }

    this.evictIfNeeded();

    const created: SessionStoreEntry = {
      id,
      provider,
      turns: [],
      createdAt: now,
      lastAccessedAt: now,
    };

    this.entries.set(key, created);

    return cloneRecord(created);
  }

  public get(provider: string, id: string): SessionRecord | undefined {
    const key = toSessionKey(provider, id);
    const existing = this.entries.get(key);

    if (!existing) return;

    existing.lastAccessedAt = new Date().toISOString();
    this.entries.delete(key);
    this.entries.set(key, existing);

    return cloneRecord(existing);
  }

  public listByProvider(provider: string): readonly SessionRecord[] {
    const records: SessionRecord[] = [];

    for (const entry of this.entries.values()) {
      if (entry.provider !== provider) continue;

      records.push(cloneRecord(entry));
    }

    return records;
  }

  public addTurn(provider: string, id: string, turn: Omit<SessionTurn, 'timestamp'>): void {
    const key = toSessionKey(provider, id);
    const entry = this.entries.get(key);

    if (!entry) return;

    entry.turns.push({ ...turn, timestamp: new Date().toISOString() });
    entry.lastAccessedAt = new Date().toISOString();
  }

  public getPrependContext(provider: string, id: string, budget: ContextBudget = {}): string {
    const entry = this.entries.get(toSessionKey(provider, id));

    if (!entry) return '';

    const maxTurns = budget.maxContextTurns ?? DEFAULT_MAX_CONTEXT_TURNS;
    const maxBytes = budget.maxContextBytes ?? DEFAULT_MAX_CONTEXT_BYTES;
    const turnWindow = entry.turns.slice(-maxTurns);
    const boundedTurns = capTurnsByBytes(turnWindow, maxBytes);

    return formatTurns(boundedTurns);
  }

  public tryAcquireLock(provider: string, id: string): boolean {
    const key = toSessionKey(provider, id);

    if (this.locks.has(key)) return false;

    this.locks.add(key);

    return true;
  }

  public releaseLock(provider: string, id: string): void {
    this.locks.delete(toSessionKey(provider, id));
  }

  public setNativeSessionId(provider: string, id: string, nativeSessionId: string): void {
    const key = toSessionKey(provider, id);
    const entry = this.entries.get(key);

    if (!entry) return;

    entry.nativeSessionId = nativeSessionId;
    entry.lastAccessedAt = new Date().toISOString();
  }

  public getNativeSessionId(provider: string, id: string): string | undefined {
    return this.entries.get(toSessionKey(provider, id))?.nativeSessionId;
  }

  public cleanupExpired(): void {
    const nowMs = Date.now();

    for (const [key, entry] of this.entries) {
      const lastAccessedMs = Date.parse(entry.lastAccessedAt);

      if (nowMs - lastAccessedMs > SESSION_TTL_MS) {
        this.entries.delete(key);
        this.locks.delete(key);
      }
    }
  }

  private evictIfNeeded(): void {
    while (this.entries.size >= MAX_SESSIONS) {
      const oldestKey = this.entries.keys().next().value;

      if (!oldestKey) return;

      this.entries.delete(oldestKey);
      this.locks.delete(oldestKey);
    }
  }
}

export const SESSION_STORE = new InMemorySessionStore();
