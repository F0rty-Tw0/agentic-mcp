import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAsk } from './ask.handler.ts';
import type { ProviderConfig } from '../../../shared/common/provider-config.schema.ts';
import type { ResolvedProviderEntry } from '../../../shared/common/provider-config.type.ts';
import type { ProgressContext } from '../common/progress-context.types.ts';

vi.mock('./arg.builder.ts', () => ({
  buildArgArray: vi.fn(() => ({ args: ['exec', 'test prompt'], stdinInput: undefined })),
}));

vi.mock('../../../shared/domain-logic/command-executor.ts', () => ({
  executeCommand: vi.fn(async () =>
    Promise.resolve({
      stdout: 'command output',
      stderr: '',
      exitCode: 0,
      signal: null,
      timedOut: false,
      truncated: false,
      stdoutBytes: 14,
      stderrBytes: 0,
      executionTimeMs: 100,
    })
  ),
}));

vi.mock('../../../shared/utils/platform.util.ts', () => ({
  buildMinimalEnv: vi.fn(() => ({ PATH: '/usr/bin' })),
  stripAnsi: vi.fn((input: string) => input),
}));

const { buildArgArray } = await import('./arg.builder.ts');
const { executeCommand } = await import('../../../shared/domain-logic/command-executor.ts');
const { buildMinimalEnv, stripAnsi } = await import('../../../shared/utils/platform.util.ts');

const successResult = {
  stdout: 'done',
  stderr: '',
  exitCode: 0 as const,
  signal: null,
  timedOut: false,
  truncated: false,
  stdoutBytes: 4,
  stderrBytes: 0,
  executionTimeMs: 35_000,
};

const createContext = (overrides: Partial<ProviderConfig> = {}): ResolvedProviderEntry => {
  const config: ProviderConfig = {
    enabled: true,
    description: 'Test provider',
    command: 'test-cli',
    timeout: 120_000,
    env: {},
    outputFormat: 'json',
    commands: { ask: { args: ['exec'], flags: {} } },
    input: { method: 'positional' },
    ...overrides,
  };

  return { name: 'test', binaryPath: '/usr/bin/test-cli', config };
};

const createExtra = (token: string | number = 'tok-1'): ProgressContext => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  ['_meta']: { progressToken: token },
});

describe('handleAsk — progress heartbeat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    vi.mocked(buildArgArray).mockReturnValue({ args: ['exec', 'test prompt'], stdinInput: undefined });
    vi.mocked(buildMinimalEnv).mockReturnValue({ PATH: '/usr/bin' });
    vi.mocked(stripAnsi).mockImplementation((input: string) => input);
    vi.mocked(executeCommand).mockResolvedValue(successResult);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('GIVEN extra with progressToken WHEN handling starts THEN sends immediate progress notification', async () => {
    const context = createContext();
    const extra = createExtra('tok-1');

    let resolveCommand!: (value: typeof successResult) => void;

    vi.mocked(executeCommand).mockReturnValue(
      new Promise((resolve) => {
        resolveCommand = resolve;
      })
    );

    const resultPromise = handleAsk(context, { prompt: 'test prompt' }, extra);

    expect(extra.sendNotification).toHaveBeenCalledTimes(1);
    expect(extra.sendNotification).toHaveBeenCalledWith({
      method: 'notifications/progress',
      params: {
        progressToken: 'tok-1',
        progress: 0,
        message: 'Processing… (0s elapsed)',
      },
    });

    resolveCommand(successResult);
    await resultPromise;
  });

  it('GIVEN extra with progressToken WHEN 30s elapses THEN sends progress notifications with immediate heartbeat included', async () => {
    const context = createContext();
    const extra = createExtra('tok-1');

    let resolveCommand!: (value: typeof successResult) => void;

    vi.mocked(executeCommand).mockReturnValue(
      new Promise((resolve) => {
        resolveCommand = resolve;
      })
    );

    const resultPromise = handleAsk(context, { prompt: 'test prompt' }, extra);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(extra.sendNotification).toHaveBeenCalledTimes(2);
    expect(extra.sendNotification).toHaveBeenCalledWith({
      method: 'notifications/progress',
      params: {
        progressToken: 'tok-1',
        progress: 1,
        message: 'Processing… (30s elapsed)',
      },
    });

    resolveCommand(successResult);
    await resultPromise;
  });

  it('GIVEN extra with progressToken WHEN 90s elapses THEN sends 3 notifications with incrementing progress', async () => {
    const context = createContext();
    const extra = createExtra();

    let resolveCommand!: (value: typeof successResult) => void;

    vi.mocked(executeCommand).mockReturnValue(
      new Promise((resolve) => {
        resolveCommand = resolve;
      })
    );

    const resultPromise = handleAsk(context, { prompt: 'test prompt' }, extra);

    await vi.advanceTimersByTimeAsync(90_000);

    expect(extra.sendNotification).toHaveBeenCalledTimes(4);

    const notifications = vi.mocked(extra.sendNotification).mock.calls.map((call) => call[0]);

    expect(notifications[0]).toMatchObject({ params: { progress: 0 } });
    expect(notifications[1]).toMatchObject({ params: { progress: 1 } });
    expect(notifications[2]).toMatchObject({ params: { progress: 2 } });
    expect(notifications[3]).toMatchObject({ params: { progress: 3 } });

    resolveCommand(successResult);
    await resultPromise;
  });

  it('GIVEN no extra WHEN handling ask THEN no notifications are sent', async () => {
    const context = createContext();

    await vi.runAllTimersAsync();
    await handleAsk(context, { prompt: 'test prompt' });

    expect(executeCommand).toHaveBeenCalledTimes(1);
  });

  it('GIVEN extra without progressToken WHEN handling ask THEN notifications use generated progress token', async () => {
    const context = createContext();
    const extra: ProgressContext = {
      sendNotification: vi.fn().mockResolvedValue(undefined),
      ['_meta']: {},
    };

    let resolveCommand!: (value: typeof successResult) => void;

    vi.mocked(executeCommand).mockReturnValue(
      new Promise((resolve) => {
        resolveCommand = resolve;
      })
    );

    const resultPromise = handleAsk(context, { prompt: 'test prompt' }, extra);

    await vi.advanceTimersByTimeAsync(60_000);

    expect(extra.sendNotification).toHaveBeenCalledTimes(3);
    const serializedNotifications = JSON.stringify(vi.mocked(extra.sendNotification).mock.calls);

    expect(serializedNotifications).toContain('agentic-mcp-heartbeat-');
    expect(serializedNotifications).toContain('"progress":0');

    resolveCommand(successResult);
    await resultPromise;
  });

  it('GIVEN extra with progressToken WHEN command completes THEN heartbeat stops', async () => {
    const context = createContext();
    const extra = createExtra();

    await handleAsk(context, { prompt: 'test prompt' }, extra);

    await vi.advanceTimersByTimeAsync(60_000);

    expect(extra.sendNotification).toHaveBeenCalledTimes(1);
  });

  it('GIVEN extra with progressToken WHEN command throws THEN heartbeat stops', async () => {
    const context = createContext();
    const extra = createExtra();

    vi.mocked(executeCommand).mockRejectedValue(new Error('spawn failed'));

    await handleAsk(context, { prompt: 'test prompt' }, extra);

    await vi.advanceTimersByTimeAsync(60_000);

    expect(extra.sendNotification).toHaveBeenCalledTimes(1);
  });

  it('GIVEN sendNotification rejects WHEN heartbeat fires THEN error is swallowed and execution continues', async () => {
    const context = createContext();
    const extra = createExtra();

    vi.mocked(extra.sendNotification).mockRejectedValue(new Error('transport closed'));

    let resolveCommand!: (value: typeof successResult) => void;

    vi.mocked(executeCommand).mockReturnValue(
      new Promise((resolve) => {
        resolveCommand = resolve;
      })
    );

    const resultPromise = handleAsk(context, { prompt: 'test prompt' }, extra);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(extra.sendNotification).toHaveBeenCalledTimes(2);

    resolveCommand(successResult);

    const result = await resultPromise;

    expect(result.content[0]).toStrictEqual({ type: 'text', text: 'done' });
  });
});
