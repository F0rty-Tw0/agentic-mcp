import type { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildSessionFlowState, executeSessionFlow } from './ask-session-flow';
import type { AskExecution, AskToolArgs } from '../../ask/common';
import { CommandExecutionError } from '../../shared';
import type { ProgressContext, ProviderConfig, ResolvedProviderEntry } from '../../shared';

const mockRunAskInvocation = vi.hoisted(() => vi.fn<() => Promise<AskExecution>>());
const mockBuildSessionPrompt = vi.hoisted(() => vi.fn<() => string>());
const mockCreateOrGet = vi.hoisted(() => vi.fn());
const mockGetNativeSessionId = vi.hoisted(() => vi.fn<() => string | undefined>());
const mockGetPrependContext = vi.hoisted(() => vi.fn<() => string>());
const mockSessionStore = vi.hoisted(() => {
  const result = {
    createOrGet: mockCreateOrGet,
    getNativeSessionId: mockGetNativeSessionId,
    getPrependContext: mockGetPrependContext,
  };

  return result;
});

vi.mock('../../ask/domain-logic/ask-runner', () => {
  const result = {
    runAskInvocation: mockRunAskInvocation,
  };

  return result;
});

vi.mock('../utils/session-context.util', () => {
  const result = {
    buildSessionPrompt: mockBuildSessionPrompt,
  };

  return result;
});

vi.mock('../data-access', () => Object.fromEntries([['SESSION_STORE', mockSessionStore]]));

const createCallToolResult = (overrides: Partial<CallToolResult> = {}): CallToolResult => {
  const content: TextContent[] = [{ type: 'text', text: 'response text' }];
  const result: CallToolResult = {
    content,
    isError: false,
    ...overrides,
  };

  return result;
};

const createAskExecution = (overrides: Partial<AskExecution> = {}): AskExecution => {
  const result: AskExecution = {
    response: createCallToolResult(),
    sessionMode: 'none',
    responseText: 'response text',
    nativeSessionId: undefined,
    wasCancelled: false,
    ...overrides,
  };

  return result;
};

const createResolvedProviderEntry = (overrides: Partial<ResolvedProviderEntry> = {}): ResolvedProviderEntry => {
  const ask = { args: [] };
  const commands = {
    ask,
  };
  const input = { method: 'flag' } as const;
  const config: ProviderConfig = {
    enabled: true,
    description: 'Test provider',
    command: 'test-cli',
    timeout: 30000,
    env: {},
    outputFormat: 'text',
    commands,
    input,
  };
  const result: ResolvedProviderEntry = {
    name: 'test-provider',
    binaryPath: '/usr/bin/test-cli',
    config,
    ...overrides,
  };

  return result;
};

const createAskToolArgs = (overrides: Partial<AskToolArgs> = {}): AskToolArgs => {
  const result: AskToolArgs = {
    prompt: 'Hello world',
    session_id: 'session-abc',
    ...overrides,
  };

  return result;
};

type SessionFlowState = {
  readonly sessionId: string;
  readonly prompt: string;
  readonly nativeSessionId?: string;
  readonly mode: 'tier1-prepend' | 'tier2-native' | 'tier2-fallback-to-tier1';
};

const createSessionFlowState = (overrides: Partial<SessionFlowState> = {}): SessionFlowState => {
  const result: SessionFlowState = {
    sessionId: 'session-abc',
    prompt: 'Hello world',
    nativeSessionId: undefined,
    mode: 'tier1-prepend',
    ...overrides,
  };

  return result;
};

describe('executeSessionFlow', () => {
  const context = createResolvedProviderEntry();
  const args = createAskToolArgs();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('GIVEN successful first execution WHEN executeSessionFlow called THEN returns result with state mode', async () => {
    const state = createSessionFlowState({ mode: 'tier1-prepend' });
    const execution = createAskExecution({ responseText: 'ok', wasCancelled: false });

    mockRunAskInvocation.mockResolvedValue(execution);

    const result = await executeSessionFlow({ context, args, state });

    expect(result.sessionMode).toBe('tier1-prepend');
    expect(result.response).toStrictEqual(execution.response);
    expect(result.responseText).toBe('ok');
    expect(result.wasCancelled).toBe(false);
  });

  it('GIVEN error in tier2-native mode WHEN executeSessionFlow called THEN retries with tier2-fallback-to-tier1', async () => {
    const state = createSessionFlowState({ mode: 'tier2-native', nativeSessionId: 'native-123' });
    const errorExecution = createAskExecution({ response: createCallToolResult({ isError: true }) });
    const fallbackExecution = createAskExecution({ responseText: 'fallback ok' });

    mockRunAskInvocation.mockResolvedValueOnce(errorExecution).mockResolvedValueOnce(fallbackExecution);

    const result = await executeSessionFlow({ context, args, state });

    expect(mockRunAskInvocation).toHaveBeenCalledTimes(2);
    expect(result.sessionMode).toBe('tier2-fallback-to-tier1');
  });

  it('GIVEN error in tier1-prepend mode WHEN executeSessionFlow called THEN returns error without retry', async () => {
    const state = createSessionFlowState({ mode: 'tier1-prepend' });
    const errorExecution = createAskExecution({ response: createCallToolResult({ isError: true }) });

    mockRunAskInvocation.mockResolvedValue(errorExecution);

    const result = await executeSessionFlow({ context, args, state });

    expect(mockRunAskInvocation).toHaveBeenCalledTimes(1);
    expect(result.response.isError).toBe(true);
    expect(result.sessionMode).toBe('tier1-prepend');
  });

  it('GIVEN fallback execution succeeds WHEN executeSessionFlow called THEN returns with sessionMode tier2-fallback-to-tier1', async () => {
    const state = createSessionFlowState({ mode: 'tier2-native', nativeSessionId: 'native-999' });
    const errorExecution = createAskExecution({ response: createCallToolResult({ isError: true }) });
    const fallbackExecution = createAskExecution({
      responseText: 'fallback response',
      nativeSessionId: 'new-native-id',
      wasCancelled: false,
    });

    mockRunAskInvocation.mockResolvedValueOnce(errorExecution).mockResolvedValueOnce(fallbackExecution);

    const result = await executeSessionFlow({ context, args, state });

    expect(result.sessionMode).toBe('tier2-fallback-to-tier1');
    expect(result.responseText).toBe('fallback response');
    expect(result.nativeSessionId).toBe('new-native-id');
    expect(result.wasCancelled).toBe(false);
  });
});

const createFailedExecution = (error: CommandExecutionError, wasCancelled = false): AskExecution => {
  const response = error.toMcpResponse();
  const result = createAskExecution({ response, wasCancelled });

  return result;
};

const TIER2_STATE = createSessionFlowState({ mode: 'tier2-native', nativeSessionId: 'native-1', prompt: 'raw' });

describe('executeSessionFlow tier2 fallback', () => {
  const context = createResolvedProviderEntry();
  const args = createAskToolArgs({ prompt: 'what is my name?', context: 'user ctx' });
  const exitFailure = new CommandExecutionError('failed', { exitCode: 1, signal: null, timedOut: false });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('GIVEN tier2 fails with an exit code WHEN falling back THEN the retry prompt carries the session history', async () => {
    mockRunAskInvocation.mockResolvedValueOnce(createFailedExecution(exitFailure));
    mockRunAskInvocation.mockResolvedValueOnce(createAskExecution());
    mockGetPrependContext.mockReturnValue('user: my name is ZED');
    mockBuildSessionPrompt.mockReturnValue('tier1 prompt with history');
    const fallbackArgs: AskToolArgs = { ...args, prompt: 'tier1 prompt with history' };

    await executeSessionFlow({ context, args, state: TIER2_STATE });

    expect(mockGetPrependContext).toHaveBeenCalledWith('test-provider', 'session-abc');
    expect(mockBuildSessionPrompt).toHaveBeenCalledWith({
      sessionTurnsText: 'user: my name is ZED',
      userContext: 'user ctx',
      prompt: 'what is my name?',
    });
    expect(mockRunAskInvocation).toHaveBeenLastCalledWith(
      expect.objectContaining({ args: fallbackArgs, tier2SessionId: undefined })
    );
  });

  it('GIVEN tier2 times out WHEN executeSessionFlow called THEN it returns the timeout without a fallback run', async () => {
    const timeout = new CommandExecutionError('failed', { exitCode: null, signal: 'SIGTERM', timedOut: true });

    mockRunAskInvocation.mockResolvedValue(createFailedExecution(timeout));

    const result = await executeSessionFlow({ context, args, state: TIER2_STATE });

    expect(mockRunAskInvocation).toHaveBeenCalledTimes(1);
    expect(result.sessionMode).toBe('tier2-native');
  });

  it('GIVEN tier2 is killed by a signal WHEN executeSessionFlow called THEN no fallback run starts', async () => {
    const killed = new CommandExecutionError('failed', { exitCode: null, signal: 'SIGKILL', timedOut: false });

    mockRunAskInvocation.mockResolvedValue(createFailedExecution(killed));

    await executeSessionFlow({ context, args, state: TIER2_STATE });

    expect(mockRunAskInvocation).toHaveBeenCalledTimes(1);
  });

  it('GIVEN tier2 failed after a cancel WHEN executeSessionFlow called THEN no fallback run starts', async () => {
    mockRunAskInvocation.mockResolvedValue(createFailedExecution(exitFailure, true));

    const result = await executeSessionFlow({ context, args, state: TIER2_STATE });

    expect(mockRunAskInvocation).toHaveBeenCalledTimes(1);
    expect(result.wasCancelled).toBe(true);
  });

  it('GIVEN the request signal is aborted WHEN tier2 fails THEN no fallback run starts', async () => {
    const controller = new AbortController();
    const extra: ProgressContext = { sendNotification: vi.fn(), signal: controller.signal };

    controller.abort();
    mockRunAskInvocation.mockResolvedValue(createFailedExecution(exitFailure));

    await executeSessionFlow({ context, args, extra, state: TIER2_STATE });

    expect(mockRunAskInvocation).toHaveBeenCalledTimes(1);
  });
});

describe('buildSessionFlowState', () => {
  const context = createResolvedProviderEntry();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('GIVEN session with existing native session id WHEN buildSessionFlowState called THEN returns tier2-native state', () => {
    const args = createAskToolArgs({ session_id: 'sess-1', prompt: 'my prompt' });

    mockCreateOrGet.mockReturnValue({});
    mockGetNativeSessionId.mockReturnValue('native-session-xyz');

    const result = buildSessionFlowState(context, args);

    expect(result.mode).toBe('tier2-native');
    expect(result.nativeSessionId).toBe('native-session-xyz');
    expect(result.sessionId).toBe('sess-1');
    expect(result.prompt).toBe('my prompt');
  });

  it('GIVEN session without native session id WHEN buildSessionFlowState called THEN returns tier1-prepend state with built prompt', () => {
    const args = createAskToolArgs({ session_id: 'sess-2', prompt: 'original prompt' });

    mockCreateOrGet.mockReturnValue({});
    mockGetNativeSessionId.mockReturnValue(undefined);
    mockGetPrependContext.mockReturnValue('');
    mockBuildSessionPrompt.mockReturnValue('built prompt');

    const result = buildSessionFlowState(context, args);

    expect(result.mode).toBe('tier1-prepend');
    expect(result.nativeSessionId).toBeUndefined();
    expect(result.prompt).toBe('built prompt');
    expect(result.sessionId).toBe('sess-2');
  });

  it('GIVEN session without native session id WHEN called THEN calls buildSessionPrompt with prepend context', () => {
    const args = createAskToolArgs({ session_id: 'sess-3', prompt: 'ask something', context: 'extra ctx' });

    mockCreateOrGet.mockReturnValue({});
    mockGetNativeSessionId.mockReturnValue(undefined);
    mockGetPrependContext.mockReturnValue('previous turns text');
    mockBuildSessionPrompt.mockReturnValue('full prompt');

    buildSessionFlowState(context, args);

    expect(mockBuildSessionPrompt).toHaveBeenCalledWith({
      sessionTurnsText: 'previous turns text',
      userContext: 'extra ctx',
      prompt: 'ask something',
    });
  });
});
