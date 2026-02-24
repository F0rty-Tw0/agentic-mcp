import { describe, expect, it } from 'vitest';

import { handleSessions } from './sessions.handler.ts';
import { SESSION_STORE } from '../../../session/session-store.ts';

describe('handleSessions', () => {
  it('GIVEN no sessions for provider WHEN listing THEN returns no sessions text', () => {
    const result = handleSessions('provider-no-sessions');

    expect(result.content[0]).toStrictEqual({ type: 'text', text: '(no sessions)' });
  });

  it('GIVEN sessions for provider WHEN listing THEN returns provider filtered sessions', () => {
    const providerName = 'sessions-provider-a';

    SESSION_STORE.createOrGet(providerName, 'session-1');
    SESSION_STORE.addTurn(providerName, 'session-1', { role: 'user', text: 'hello' });
    SESSION_STORE.createOrGet('sessions-provider-b', 'session-2');

    const result = handleSessions(providerName);
    const text = result.content[0]?.type === 'text' ? result.content[0].text : '';

    expect(text).toContain('session-1');
    expect(text).toContain('turns=1');
    expect(text).not.toContain('session-2');
  });
});
