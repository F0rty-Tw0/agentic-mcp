import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appendSessionMetadata, buildSessionFlowState, executeSessionFlow } from './ask-session-flow.util';
import type { SessionFlowState } from './ask-session-flow.util';
import type { ResolvedProviderEntry } from '../../../shared/common';
import type { AskToolArgs, SessionMode } from '../../common';
import type { AskExecution } from '../../domain-logic/ask-runner';

const mockRunAskInvocation = vi.hoisted(() => vi.fn<() => Promise<AskExecution>>());
const mockBuildSessionPrompt = vi.hoisted(() => vi.fn<() => string>());
const mockCreateOrGet = vi.hoisted(() => vi.fn());
const mockGetNativeSessionId = vi.hoisted(() => vi.fn<() => string | undefined>());
const mockGetPrependContext = vi.hoisted(() => vi.fn<() => string>());

vi.mock('../../domain-logic/ask-runner', () => ({
  runAskInvocation: mockRunAskInvocation,
}));

vi.mock('./session-context.util', () => ({
  buildSessionPrompt: mockBuildSessionPrompt,
}));

vi.mock('../../../session/session-store', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  SESSION_STORE: {
    createOrGet: mockCreateOrGet,
    getNativeSessionId: mockGetNativeSessionId,
    getPrependContext: mockGetPrependContext,
  },
}));

const createCallToolResult = (overrides: Partial<CallToolResult> = {}): CallToolResult => ({
  content: [{ type: 'text', text: 'response text' }],
  isError: false,
  ...overrides,
});

const createAskExecution = (overrides: Partial<AskExecution> = {}): AskExecution => ({
  response: createCallToolResult(),
  sessionMode: 'none',
  responseText: 'response text',
  nativeSessionId: undefined,
  wasCancelled: false,
  ...overrides,
});

const createResolvedProviderEntry = (overrides: Partial<ResolvedProviderEntry> = {}): ResolvedProviderEntry => ({
  name: 'test-provider',
  binaryPath: '/usr/bin/test-cli',
  config: {
    enabled: true,
    description: 'Test provider',
    command: 'test-cli',
    timeout: 30000,
    env: {},
    outputFormat: 'text',
    commands: {
      ask: { args: [] },
    },
    input: { method: 'flag' },
  },
  ...overrides,
});

const createAskToolArgs = (overrides: Partial<AskToolArgs> = {}): AskToolArgs => ({
  prompt: 'Hello world',
  session_id: 'session-abc',
  ...overrides,
});

const createSessionFlowState = (overrides: Partial<SessionFlowState> = {}): SessionFlowState => ({
  sessionId: 'session-abc',
  prompt: 'Hello world',
  nativeSessionId: undefined,
  mode: 'tier1-prepend',
  ...overrides,
});

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

describe('appendSessionMetadata', () => {
  it('GIVEN sessionMode "none" WHEN appendSessionMetadata called THEN returns response unchanged', () => {
    const response = createCallToolResult({ content: [{ type: 'text', text: 'hello' }] });

    const result = appendSessionMetadata(response, 'none');

    expect(result).toBe(response);
  });

  it('GIVEN sessionMode "tier1-prepend" WHEN appendSessionMetadata called THEN appends metadata content', () => {
    const response = createCallToolResult({ content: [{ type: 'text', text: 'hello' }] });
    const mode: SessionMode = 'tier1-prepend';

    const result = appendSessionMetadata(response, mode);

    expect(result.content).toHaveLength(2);
    const last = result.content.at(-1);

    expect(last).toStrictEqual({
      type: 'text',
      text: JSON.stringify({ sessionMode: 'tier1-prepend' }, null, 2),
    });
  });

  it('GIVEN sessionMode "tier2-native" WHEN appendSessionMetadata called THEN appends metadata content', () => {
    const response = createCallToolResult({ content: [{ type: 'text', text: 'hello' }] });
    const mode: SessionMode = 'tier2-native';

    const result = appendSessionMetadata(response, mode);

    expect(result.content).toHaveLength(2);
    const last = result.content.at(-1);

    expect(last).toStrictEqual({
      type: 'text',
      text: JSON.stringify({ sessionMode: 'tier2-native' }, null, 2),
    });
  });
});
