import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SessionRecord } from '../common';
import { MAX_SESSIONS, SESSION_TTL_MS } from '../common';
import { InMemorySessionStore } from './session-store';

afterEach(() => {
  vi.useRealTimers();
});

const getListedSession = (listed: readonly SessionRecord[]): SessionRecord => {
  const listedSession = listed[0];

  if (listedSession == null) {
    throw new Error('listed session missing');
  }

  return listedSession;
};

describe('InMemorySessionStore', () => {
  it('GIVEN a missing session WHEN createOrGet THEN returns empty session', () => {
    const store = new InMemorySessionStore();

    const session = store.createOrGet('claude', 's1');

    expect(session.id).toBe('s1');
    expect(session.turns).toStrictEqual([]);
  });

  it('GIVEN existing session WHEN adding turns THEN prepend context respects turn budget', () => {
    const store = new InMemorySessionStore();

    store.createOrGet('claude', 's1');
    store.addTurn('claude', 's1', { role: 'user', text: 'u1' });
    store.addTurn('claude', 's1', { role: 'assistant', text: 'a1' });
    store.addTurn('claude', 's1', { role: 'user', text: 'u2' });

    const context = store.getPrependContext('claude', 's1', { maxContextTurns: 2 });

    expect(context).toContain('assistant: a1');
    expect(context).toContain('user: u2');
    expect(context).not.toContain('u1');
  });

  it('GIVEN existing session WHEN createOrGet is called again THEN it returns the existing record', () => {
    const store = new InMemorySessionStore();

    store.createOrGet('claude', 's1');
    store.addTurn('claude', 's1', { role: 'user', text: 'hello' });

    const session = store.createOrGet('claude', 's1');

    expect(session.id).toBe('s1');
    expect(session.turns).toHaveLength(1);
  });

  it('GIVEN existing session WHEN setNativeSessionId THEN getNativeSessionId returns it', () => {
    const store = new InMemorySessionStore();

    store.createOrGet('claude', 's1');
    store.setNativeSessionId('claude', 's1', 'native-abc');

    expect(store.getNativeSessionId('claude', 's1')).toBe('native-abc');
  });

  it('GIVEN no session WHEN setNativeSessionId THEN getNativeSessionId returns undefined', () => {
    const store = new InMemorySessionStore();

    store.setNativeSessionId('claude', 'missing', 'native-abc');

    expect(store.getNativeSessionId('claude', 'missing')).toBeUndefined();
  });

  it('GIVEN store at capacity WHEN createOrGet adds a new session THEN oldest session is evicted', () => {
    const store = new InMemorySessionStore();

    for (let i = 0; i < MAX_SESSIONS; i++) {
      store.createOrGet('claude', `s${i}`);
    }

    store.createOrGet('claude', 'overflow');

    expect(store.get('claude', 's0')).toBeUndefined();
    expect(store.get('claude', 'overflow')).toBeDefined();
  });

  it('GIVEN session lock WHEN second request tries to acquire THEN it fails until release', () => {
    const store = new InMemorySessionStore();

    store.createOrGet('claude', 's1');

    expect(store.tryAcquireLock('claude', 's1')).toBe(true);
    expect(store.tryAcquireLock('claude', 's1')).toBe(false);

    store.releaseLock('claude', 's1');

    expect(store.tryAcquireLock('claude', 's1')).toBe(true);
  });

  it('GIVEN sessions from multiple providers WHEN listing by provider THEN only matching provider records are returned as clones', () => {
    const store = new InMemorySessionStore();

    store.createOrGet('claude', 's1');
    store.createOrGet('codex', 's2');
    store.addTurn('claude', 's1', { role: 'user', text: 'hello' });

    const listed = store.listByProvider('claude');
    const listedSession = getListedSession(listed);
    const storedSession = store.get('claude', 's1');

    expect(listed).toHaveLength(1);
    expect(listedSession.provider).toBe('claude');
    expect(listedSession.turns).toHaveLength(1);
    expect(listedSession).not.toBe(storedSession);
    expect(listedSession.turns).not.toBe(storedSession?.turns);
  });

  it('GIVEN expired locked session WHEN cleanupExpired runs THEN it removes the session and releases the lock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const store = new InMemorySessionStore();

    store.createOrGet('claude', 's1');

    expect(store.tryAcquireLock('claude', 's1')).toBe(true);

    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z').getTime() + SESSION_TTL_MS + 1);
    store.cleanupExpired();

    expect(store.get('claude', 's1')).toBeUndefined();
    expect(store.tryAcquireLock('claude', 's1')).toBe(true);
  });
  it('GIVEN existing session WHEN getPrependContext uses default budget THEN it returns stored turns', () => {
    const store = new InMemorySessionStore();

    store.createOrGet('claude', 's1');
    store.addTurn('claude', 's1', { role: 'user', text: 'hello' });

    const context = store.getPrependContext('claude', 's1');

    expect(context).toContain('user: hello');
  });

  it('GIVEN missing session WHEN addTurn is called THEN it does nothing', () => {
    const store = new InMemorySessionStore();

    store.addTurn('claude', 'missing', { role: 'user', text: 'hello' });

    expect(store.get('claude', 'missing')).toBeUndefined();
  });

  it('GIVEN missing session WHEN getPrependContext is called THEN it returns an empty string', () => {
    const store = new InMemorySessionStore();

    const context = store.getPrependContext('claude', 'missing');

    expect(context).toBe('');
  });
});
