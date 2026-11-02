import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildSessionFlowState, executeSessionFlow } from './ask-session-flow';
import type { AskExecution } from '../../ask/common';
import {
  createAskExecution,
  createAskToolArgs,
  createResolvedProviderEntry,
  createSessionFlowState,
} from '../test/utils/ask-session-flow.spec.util';

const mockRunAskInvocation = vi.hoisted(() => vi.fn<() => Promise<AskExecution>>());
const mockBuildSessionPrompt = vi.hoisted(() => vi.fn<() => string>());
const mockCreateOrGet = vi.hoisted(() => vi.fn());
const mockGetNativeSessionId = vi.hoisted(() => vi.fn<() => string | undefined>());
const mockGetPrependContext = vi.hoisted(() => vi.fn<() => string>());
const mockIsNativeStartDisabled = vi.hoisted(() => vi.fn<() => boolean>());
const mockSessionStore = vi.hoisted(() => {
  const result = {
    createOrGet: mockCreateOrGet,
    getNativeSessionId: mockGetNativeSessionId,
    getPrependContext: mockGetPrependContext,
    isNativeStartDisabled: mockIsNativeStartDisabled,
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

describe('executeSessionFlow prompt validation', () => {
  const context = createResolvedProviderEntry();
  const state = createSessionFlowState();

  beforeEach(() => {
    vi.resetAllMocks();
    mockRunAskInvocation.mockResolvedValue(createAskExecution());
  });

  it('GIVEN a session ask without a prompt WHEN executeSessionFlow called THEN it returns a validation error without running', async () => {
    const args = createAskToolArgs({ prompt: undefined });

    const result = await executeSessionFlow({ context, args, state });

    const content = [{ type: 'text', text: 'Validation error: Prompt is required' }];

    expect(mockRunAskInvocation).not.toHaveBeenCalled();
    expect(result.response).toStrictEqual({ isError: true, content });
  });

  it('GIVEN a session ask with an empty prompt WHEN executeSessionFlow called THEN it returns a validation error', async () => {
    const args = createAskToolArgs({ prompt: '' });

    const result = await executeSessionFlow({ context, args, state });

    expect(mockRunAskInvocation).not.toHaveBeenCalled();
    expect(result.response.isError).toBe(true);
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
