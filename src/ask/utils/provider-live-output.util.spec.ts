import { describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { createProviderLiveOutputAdapter } from './provider-live-output.util';
import type { StreamNotifier } from '../../streaming';

type StreamNotifierStub = Readonly<{
  notifier: StreamNotifier;
  stdoutSpy: MockInstance;
  stderrSpy: MockInstance;
}>;

const createStreamNotifierStub = (): StreamNotifierStub => {
  const stdoutSpy = vi.fn();
  const stderrSpy = vi.fn();
  const emitStartSpy = vi.fn();
  const emitDoneSpy = vi.fn();
  const emitErrorSpy = vi.fn();
  const stopSpy = vi.fn();

  const notifier: StreamNotifier = {
    onStdoutChunk: stdoutSpy,
    onStderrChunk: stderrSpy,
    emitStart: emitStartSpy,
    emitDone: emitDoneSpy,
    emitError: emitErrorSpy,
    stop: stopSpy,
    enabled: true,
  };

  const result: StreamNotifierStub = { notifier, stdoutSpy, stderrSpy };

  return result;
};

const createAssistantLine = (item: Record<string, unknown>): string => {
  const line = JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [item],
    },
  });

  return line;
};

const createAssistantMessageLine = (content: ReadonlyArray<Record<string, unknown>>): string => {
  const line = JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content,
    },
  });

  return line;
};

describe('createProviderLiveOutputAdapter', () => {
  it('GIVEN a non-claude provider WHEN adapting live output THEN it passes stdout and stderr through unchanged', () => {
    const { notifier, stdoutSpy, stderrSpy } = createStreamNotifierStub();
    const adapter = createProviderLiveOutputAdapter({
      providerName: 'codex',
      outputFormat: 'text',
      streamNotifier: notifier,
    });

    adapter.onStdoutChunk('stdout text');
    adapter.onStderrChunk('stderr text');
    adapter.flush();

    expect(stdoutSpy).toHaveBeenCalledExactlyOnceWith('stdout text');
    expect(stderrSpy).toHaveBeenCalledExactlyOnceWith('stderr text');
  });

  it('GIVEN claude stream-json chunks WHEN a line completes across chunk boundaries THEN it emits parsed progress lines to stderr', () => {
    const { notifier, stdoutSpy, stderrSpy } = createStreamNotifierStub();
    const adapter = createProviderLiveOutputAdapter({
      providerName: 'claude',
      outputFormat: 'stream-json',
      streamNotifier: notifier,
    });
    const thinkingLine = `${createAssistantLine({ type: 'thinking', thinking: 'planning' })}\n`;
    const toolUseLine = createAssistantLine({
      type: 'tool_use',
      name: 'bash',
      input: { command: 'pwd' },
    });
    const textLine = `${createAssistantLine({ type: 'text', text: '  done  ' })}\n`;

    adapter.onStdoutChunk(thinkingLine + toolUseLine.slice(0, 40));
    adapter.onStdoutChunk(`${toolUseLine.slice(40)}\n${textLine}`);

    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledTimes(3);
    expect(stderrSpy).toHaveBeenNthCalledWith(1, 'Thinking...\n');
    expect(stderrSpy).toHaveBeenNthCalledWith(2, 'Using bash: pwd\n');
    expect(stderrSpy).toHaveBeenNthCalledWith(3, 'done\n');
  });

  it('GIVEN a trailing claude stream-json line without a newline WHEN flushing THEN it emits the remaining parsed progress line', () => {
    const { notifier, stderrSpy } = createStreamNotifierStub();
    const adapter = createProviderLiveOutputAdapter({
      providerName: 'claude',
      outputFormat: 'stream-json',
      streamNotifier: notifier,
    });
    const toolUseLine = createAssistantLine({
      type: 'tool_use',
      name: 'write',
      input: { file_path: 'src/ask/utils/provider-live-output.util.ts' },
    });

    adapter.onStdoutChunk(toolUseLine);
    adapter.flush();

    expect(stderrSpy).toHaveBeenCalledExactlyOnceWith('Using write: src/ask/utils/provider-live-output.util.ts\n');
  });

  it('GIVEN claude stream-json stdout with raw and unsupported events WHEN adapting THEN it forwards only meaningful progress lines', () => {
    const { notifier, stderrSpy } = createStreamNotifierStub();
    const adapter = createProviderLiveOutputAdapter({
      providerName: 'claude',
      outputFormat: 'stream-json',
      streamNotifier: notifier,
    });
    const rawProgressLine = '  scanning repo  ';
    const ignoredEventLine = JSON.stringify({ type: 'result', result: 'ignored' });
    const blankLine = '   ';
    const chunk = `${rawProgressLine}\n${ignoredEventLine}\n${blankLine}\n`;

    adapter.onStdoutChunk(chunk);

    expect(stderrSpy).toHaveBeenCalledExactlyOnceWith('scanning repo\n');
  });
  it('GIVEN a claude provider without stream-json output WHEN adapting live output THEN it falls back to passthrough output', () => {
    const { notifier, stdoutSpy, stderrSpy } = createStreamNotifierStub();
    const adapter = createProviderLiveOutputAdapter({
      providerName: 'claude',
      outputFormat: 'text',
      streamNotifier: notifier,
    });

    adapter.onStdoutChunk('plain stdout');
    adapter.onStderrChunk('plain stderr');
    adapter.flush();

    expect(stdoutSpy).toHaveBeenCalledExactlyOnceWith('plain stdout');
    expect(stderrSpy).toHaveBeenCalledExactlyOnceWith('plain stderr');
  });

  it('GIVEN a claude tool-use item with multiple detail fields WHEN adapting live output THEN it prefers the description', () => {
    const { notifier, stderrSpy } = createStreamNotifierStub();
    const adapter = createProviderLiveOutputAdapter({
      providerName: 'claude',
      outputFormat: 'stream-json',
      streamNotifier: notifier,
    });
    const toolUseLine = `${createAssistantLine({
      type: 'tool_use',
      name: 'read',
      input: {
        description: 'Reading target file',
        file_path: 'ignored.ts',
        command: 'ignored command',
      },
    })}\n`;

    adapter.onStdoutChunk(toolUseLine);

    expect(stderrSpy).toHaveBeenCalledExactlyOnceWith('Using read: Reading target file\n');
  });

  it('GIVEN a claude tool-use item with a non-object input WHEN adapting live output THEN it emits the generic tool name', () => {
    const { notifier, stderrSpy } = createStreamNotifierStub();
    const adapter = createProviderLiveOutputAdapter({
      providerName: 'claude',
      outputFormat: 'stream-json',
      streamNotifier: notifier,
    });
    const toolUseLine = `${createAssistantLine({
      type: 'tool_use',
      name: 'grep',
      input: 'pwd',
    })}\n`;

    adapter.onStdoutChunk(toolUseLine);

    expect(stderrSpy).toHaveBeenCalledExactlyOnceWith('Using grep\n');
  });

  it('GIVEN a claude tool-use item with only a command detail WHEN adapting live output THEN it emits the command detail', () => {
    const { notifier, stderrSpy } = createStreamNotifierStub();
    const adapter = createProviderLiveOutputAdapter({
      providerName: 'claude',
      outputFormat: 'stream-json',
      streamNotifier: notifier,
    });
    const toolUseLine = `${createAssistantLine({
      type: 'tool_use',
      name: 'bash',
      input: { command: 'pwd' },
    })}\n`;

    adapter.onStdoutChunk(toolUseLine);

    expect(stderrSpy).toHaveBeenCalledExactlyOnceWith('Using bash: pwd\n');
  });

  it('GIVEN a claude tool-use item with a non-string command WHEN adapting live output THEN it emits the generic tool name', () => {
    const { notifier, stderrSpy } = createStreamNotifierStub();
    const adapter = createProviderLiveOutputAdapter({
      providerName: 'claude',
      outputFormat: 'stream-json',
      streamNotifier: notifier,
    });
    const toolUseLine = `${createAssistantLine({
      type: 'tool_use',
      name: 'bash',
      input: { command: 123 },
    })}\n`;

    adapter.onStdoutChunk(toolUseLine);

    expect(stderrSpy).toHaveBeenCalledExactlyOnceWith('Using bash\n');
  });

  it('GIVEN a claude assistant message with blank and malformed items WHEN adapting live output THEN it emits only valid progress content', () => {
    const { notifier, stderrSpy } = createStreamNotifierStub();
    const adapter = createProviderLiveOutputAdapter({
      providerName: 'claude',
      outputFormat: 'stream-json',
      streamNotifier: notifier,
    });
    const assistantLine = `${createAssistantMessageLine([
      { type: 'text', text: '   ' },
      { type: 'image', url: 'ignored' },
      { type: 'tool_use', input: { command: 'pwd' } },
      {},
      { type: 'text', text: ' kept ' },
    ])}\n`;

    adapter.onStdoutChunk(assistantLine);

    expect(stderrSpy).toHaveBeenCalledExactlyOnceWith('kept\n');
  });

  it('GIVEN a claude assistant event without a message content array WHEN adapting live output THEN it ignores the event', () => {
    const { notifier, stderrSpy } = createStreamNotifierStub();
    const adapter = createProviderLiveOutputAdapter({
      providerName: 'claude',
      outputFormat: 'stream-json',
      streamNotifier: notifier,
    });
    const invalidAssistantLine = `${JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: 'not-an-array' },
    })}\n`;

    adapter.onStdoutChunk(invalidAssistantLine);

    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('GIVEN a claude assistant event without a message object WHEN adapting live output THEN it ignores the event', () => {
    const { notifier, stderrSpy } = createStreamNotifierStub();
    const adapter = createProviderLiveOutputAdapter({
      providerName: 'claude',
      outputFormat: 'stream-json',
      streamNotifier: notifier,
    });
    const invalidAssistantLine = `${JSON.stringify({
      type: 'assistant',
      message: null,
    })}\n`;

    adapter.onStdoutChunk(invalidAssistantLine);

    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('GIVEN a claude stream-json adapter with no buffered stdout WHEN flushing THEN it does nothing', () => {
    const { notifier, stderrSpy } = createStreamNotifierStub();
    const adapter = createProviderLiveOutputAdapter({
      providerName: 'claude',
      outputFormat: 'stream-json',
      streamNotifier: notifier,
    });

    adapter.flush();

    expect(stderrSpy).not.toHaveBeenCalled();
  });
});
