/**
 * Integration test — exercises request cancellation and timeout behavior
 * end-to-end. No mocks, no stubs. Uses real child processes via handleAsk.
 *
 * Uses `.test` extension to distinguish from unit `.spec` files.
 * Run with: pnpm run test:integration
 */

import { describe, expect, it } from 'vitest';

import { handleAsk } from './ask.handler';
import type { ProgressContext, ProviderConfig, ResolvedProviderEntry } from '../../shared';

const createLongRunningContext = (timeoutMs = 10_000): ResolvedProviderEntry => {
  const script = "setTimeout(() => { process.stdout.write('done'); process.exit(0); }, 5000);";

  const config: ProviderConfig = {
    enabled: true,
    description: 'Node long-running test provider',
    command: process.execPath,
    timeout: timeoutMs,
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
    name: 'node-long',
    binaryPath: process.execPath,
    config,
  };

  return context;
};

describe('integration: handleAsk cancellation', () => {
  it('GIVEN a long-running process WHEN abort signal fires THEN response indicates cancellation', async () => {
    const context = createLongRunningContext();
    const controller = new AbortController();
    const extra = { signal: controller.signal } as ProgressContext;

    setTimeout(() => controller.abort(), 200);

    const result = await handleAsk(context, { prompt: 'ignored' }, extra);

    expect(result.isError).toBe(true);
  });
});

describe('integration: handleAsk timeout', () => {
  it('GIVEN a process exceeding timeout WHEN handleAsk runs THEN response indicates timeout', async () => {
    const context = createLongRunningContext(500);

    const result = await handleAsk(context, { prompt: 'ignored' });

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;

    expect(text.toLowerCase()).toMatch(/timed?\s*out|timeout|killed/i);
  });
});
