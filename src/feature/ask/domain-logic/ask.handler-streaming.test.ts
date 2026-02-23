import { describe, expect, it } from 'vitest';

import { handleAsk } from './ask.handler.ts';
import type { ProviderConfig, ResolvedProviderEntry } from '../../../shared/common/index.ts';
import type { ProgressContext } from '../common/index.ts';

type ProgressNotification = Readonly<{
  method: string;
  params: Readonly<{ message: string }>;
}>;

const createStreamingProviderContext = (): ResolvedProviderEntry => {
  const inlineScript = [
    "process.stdout.write('out-1\\n');",
    "process.stderr.write('err-1\\n');",
    "setTimeout(() => { process.stdout.write('out-2\\n'); process.stderr.write('err-2\\n'); }, 20);",
    'setTimeout(() => process.exit(0), 40);',
  ].join('');

  const config: ProviderConfig = {
    enabled: true,
    description: 'Node streaming test provider',
    command: process.execPath,
    timeout: 10_000,
    env: {},
    outputFormat: 'json',
    commands: {
      ask: {
        args: ['-e', inlineScript],
        flags: {},
      },
    },
    input: { method: 'positional' },
  };

  const context: ResolvedProviderEntry = {
    name: 'node-streaming',
    binaryPath: process.execPath,
    config,
  };

  return context;
};

const createProgressContext = (notifications: ProgressNotification[]): ProgressContext => {
  const context = {
    sendNotification: async (notification: ProgressNotification) => {
      await Promise.resolve();
      notifications.push(notification);
    },
  } as unknown as ProgressContext;

  // eslint-disable-next-line no-underscore-dangle
  context._meta = { progressToken: 'progress-1' };

  return context;
};

describe('handleAsk live streaming integration', () => {
  it('GIVEN real process interleaved stdout and stderr WHEN stream_live is enabled THEN emits contiguous sequence with terminal done event', async () => {
    const context = createStreamingProviderContext();
    const notifications: ProgressNotification[] = [];
    const extra = createProgressContext(notifications);

    const result = await handleAsk(context, { prompt: 'ignored', stream_live: true }, extra);
    const events = notifications.map(
      (notification) => JSON.parse(notification.params.message) as Readonly<Record<string, unknown>>
    );
    const sequences = events.map((event) => Number(event.sequence));
    const channels = events.filter((event) => event.type === 'chunk').map((event) => String(event.channel));
    const terminal = events[events.length - 1];

    expect(result.isError).not.toBe(true);
    expect(events.length).toBeGreaterThan(0);
    expect(sequences).toStrictEqual(Array.from({ length: sequences.length }, (_, index) => index + 1));
    expect(channels).toContain('stdout');
    expect(channels).toContain('stderr');
    expect(terminal?.type).toBe('done');
  });
});
