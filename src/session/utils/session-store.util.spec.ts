import { describe, expect, it } from 'vitest';

import { cloneRecord, formatTurns, toSessionKey } from './session-store.util';
import type { SessionTurn } from '../common/session-store.type';

describe('toSessionKey', () => {
  it('GIVEN provider and id WHEN building key THEN returns colon separated key', () => {
    const result = toSessionKey('claude', 's1');

    expect(result).toBe('claude:s1');
  });
});

describe('cloneRecord', () => {
  it('GIVEN session store entry WHEN cloning THEN returns independent session record copy', () => {
    const turns: SessionTurn[] = [{ role: 'user', text: 'hello', timestamp: '2026-01-01T00:00:00.000Z' }];

    const result = cloneRecord({
      id: 's1',
      provider: 'claude',
      turns,
      createdAt: '2026-01-01T00:00:00.000Z',
      lastAccessedAt: '2026-01-01T00:00:00.000Z',
      nativeSessionId: 'native-1',
    });

    turns.push({ role: 'assistant', text: 'reply', timestamp: '2026-01-01T00:01:00.000Z' });

    expect(result.turns).toHaveLength(1);
    expect(result.nativeSessionId).toBe('native-1');
  });
});

describe('formatTurns', () => {
  it('GIVEN turns WHEN formatting THEN returns line-per-turn text', () => {
    const turns: readonly SessionTurn[] = [
      { role: 'user', text: 'u1', timestamp: '2026-01-01T00:00:00.000Z' },
      { role: 'assistant', text: 'a1', timestamp: '2026-01-01T00:01:00.000Z' },
    ];

    const result = formatTurns(turns);

    expect(result).toBe('user: u1\nassistant: a1');
  });
});
