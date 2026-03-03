/**
 * Integration test — exercises session management end-to-end.
 * Tests lock contention, sequential turn accumulation, and session listing.
 * No mocks, no stubs. Uses real child processes via handleAsk.
 *
 * Uses `.test` extension to distinguish from unit `.spec` files.
 * Run with: pnpm run test:integration
 */

import { describe, expect, it } from 'vitest';

import { handleAsk } from './ask.handler';
import { SESSION_STORE } from '../../session';
import type { ProviderConfig, ResolvedProviderEntry } from '../../shared';

let sessionCounter = 0;

const uniqueSessionId = (): string => {
  sessionCounter += 1;

  return `test-session-${Date.now()}-${sessionCounter}`;
};

const createSessionProviderContext = (): ResolvedProviderEntry => {
  const script = "setTimeout(() => { process.stdout.write('session-response'); process.exit(0); }, 100);";

  const config: ProviderConfig = {
    enabled: true,
    description: 'Node session test provider',
    command: process.execPath,
    timeout: 10_000,
    env: {},
    outputFormat: 'json',
    commands: {
      ask: {
        args: ['-e', script],
        flags: {},
      },
    },
    input: { method: 'positional' },
  };

  const context: ResolvedProviderEntry = {
    name: 'node-session',
    binaryPath: process.execPath,
    config,
  };

  return context;
};

describe('integration: session lock contention', () => {
  it('GIVEN two concurrent calls with the same session_id WHEN both run THEN one succeeds and the other returns session in use', async () => {
    const context = createSessionProviderContext();
    const sessionId = uniqueSessionId();

    const [resultA, resultB] = await Promise.all([
      handleAsk(context, { prompt: 'first', session_id: sessionId }),
      handleAsk(context, { prompt: 'second', session_id: sessionId }),
    ]);

    const results = [resultA, resultB];
    const successes = results.filter((r) => !r.isError);
    const failures = results.filter((r) => r.isError);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const failure = failures[0];

    if (!failure) return;

    const failureText = (failure.content[0] as { text: string }).text;

    expect(failureText).toContain('session in use');
    expect(failureText).toContain(sessionId);
  });
});

describe('integration: sequential session turns', () => {
  it('GIVEN a completed session call WHEN a second call uses the same session_id THEN the lock is released and both succeed', async () => {
    const context = createSessionProviderContext();
    const sessionId = uniqueSessionId();

    const firstResult = await handleAsk(context, { prompt: 'hello', session_id: sessionId });

    expect(firstResult.isError).not.toBe(true);

    const secondResult = await handleAsk(context, { prompt: 'follow-up', session_id: sessionId });

    expect(secondResult.isError).not.toBe(true);
  });

  it('GIVEN two sequential session calls WHEN checking the store THEN turns are accumulated', async () => {
    const context = createSessionProviderContext();
    const sessionId = uniqueSessionId();

    await handleAsk(context, { prompt: 'turn-one', session_id: sessionId });
    await handleAsk(context, { prompt: 'turn-two', session_id: sessionId });

    const record = SESSION_STORE.get(context.name, sessionId);

    expect(record).toBeDefined();

    if (!record) return;

    // Each successful call stores a user + assistant turn pair
    expect(record.turns.length).toBeGreaterThanOrEqual(4);
  });
});

describe('integration: session listing', () => {
  it('GIVEN a session call WHEN listing sessions by provider THEN the session appears', async () => {
    const context = createSessionProviderContext();
    const sessionId = uniqueSessionId();

    await handleAsk(context, { prompt: 'listed', session_id: sessionId });

    const sessions = SESSION_STORE.listByProvider(context.name);
    const sessionIds = sessions.map((s) => s.id);

    expect(sessionIds).toContain(sessionId);
  });
});
