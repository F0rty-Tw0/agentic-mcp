import { describe, expect, it } from 'vitest';

import { InMemorySessionStore } from './session-store.ts';

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

  it('GIVEN session lock WHEN second request tries to acquire THEN it fails until release', () => {
    const store = new InMemorySessionStore();

    store.createOrGet('claude', 's1');

    expect(store.tryAcquireLock('claude', 's1')).toBe(true);
    expect(store.tryAcquireLock('claude', 's1')).toBe(false);

    store.releaseLock('claude', 's1');

    expect(store.tryAcquireLock('claude', 's1')).toBe(true);
  });
});
