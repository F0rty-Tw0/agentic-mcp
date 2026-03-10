import { describe, expect, it } from 'vitest';

import { handleAsk } from './ask.handler';
import type { ProgressContext, ProviderConfig, ResolvedProviderEntry } from '../../shared';
import type { ProgressNotification } from '../common';

type StreamEvent = Readonly<Record<string, unknown>>;

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
  } as ProgressContext;

  // eslint-disable-next-line no-underscore-dangle
  context._meta = { progressToken: 'progress-1' };

  return context;
};

const parseEvents = (notifications: ProgressNotification[]): StreamEvent[] => {
  const events = notifications.map((notification) => JSON.parse(notification.params.message) as StreamEvent);

  return events;
};

const createClaudeStreamingProviderContext = (): ResolvedProviderEntry => {
  const inlineScript = [
    "const isStreaming = process.argv.includes('--verbose') && process.argv.includes('stream-json');",
    'const emit = (line, delay) => setTimeout(() => process.stdout.write(`${line}\\n`), delay);',
    'if (!isStreaming) {',
    "  setTimeout(() => { process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'final answer', session_id: 'session-1' }) + '\\n'); process.exit(0); }, 40);",
    '} else {',
    "  emit(JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'thinking', thinking: 'planning' }] } }), 0);",
    "  emit(JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'README.md' } }] } }), 10);",
    "  emit(JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Exploring repo...' }] } }), 20);",
    "  emit(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'final answer', session_id: 'session-1' }), 30);",
    '  setTimeout(() => process.exit(0), 50);',
    '}',
  ].join('');

  const config = {
    enabled: true,
    description: 'Claude-style streaming test provider',
    command: process.execPath,
    timeout: 10_000,
    env: {},
    outputFormat: 'json',
    commands: {
      ask: {
        args: ['-e', inlineScript],
        trailingArgs: ['--output-format', 'json'],
        flags: {},
        streaming: {
          trailingArgs: ['--verbose', '--output-format', 'stream-json'],
          outputFormat: 'stream-json',
        },
      },
    },
    input: { method: 'positional' },
  } as ProviderConfig;

  const context: ResolvedProviderEntry = {
    name: 'claude',
    binaryPath: process.execPath,
    config,
  };

  return context;
};

describe('handleAsk live streaming integration', () => {
  it('GIVEN Claude-style streaming overrides WHEN stream_live is enabled THEN it emits readable progress and keeps the final parsed answer', async () => {
    const context = createClaudeStreamingProviderContext();
    const notifications: ProgressNotification[] = [];
    const extra = createProgressContext(notifications);

    const result = await handleAsk(context, { prompt: 'ignored', stream_live: true }, extra);
    const events = parseEvents(notifications);
    const stderrChunks = events
      .filter((event) => event.type === 'chunk' && event.channel === 'stderr')
      .map((event) => String(event.chunk))
      .join('');
    const leakedJsonChunks = events
      .filter((event) => event.type === 'chunk')
      .map((event) => String(event.chunk))
      .filter((chunk) => chunk.includes('"type":"assistant"') || chunk.includes('"type":"result"'));

    expect(stderrChunks).toContain('Thinking...');
    expect(stderrChunks).toContain('Using Read: README.md');
    expect(stderrChunks).toContain('Exploring repo...');
    expect(leakedJsonChunks).toHaveLength(0);
    expect(result.content[0]).toStrictEqual({ type: 'text', text: 'final answer' });
  });

  it('GIVEN real process interleaved stdout and stderr WHEN stream_live is enabled THEN emits contiguous sequence with terminal done event', async () => {
    const context = createStreamingProviderContext();
    const notifications: ProgressNotification[] = [];
    const extra = createProgressContext(notifications);

    const result = await handleAsk(context, { prompt: 'ignored', stream_live: true }, extra);
    const events = notifications.map((notification) => JSON.parse(notification.params.message) as StreamEvent);
    const sequences = events.map((event) => Number(event.sequence));
    const channels = events.filter((event) => event.type === 'chunk').map((event) => String(event.channel));
    const terminal = events.at(-1);

    expect(result.isError).not.toBe(true);
    expect(events.length).toBeGreaterThan(0);
    expect(sequences).toStrictEqual(Array.from({ length: sequences.length }, (_, index) => index + 1));
    expect(channels).toContain('stdout');
    expect(channels).toContain('stderr');
    expect(terminal?.type).toBe('done');
  });
});
