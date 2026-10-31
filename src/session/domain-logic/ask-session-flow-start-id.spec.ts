import type { CallToolResult, TextContent } from '@modelcontextprotocol/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildSessionFlowState, executeSessionFlow } from './ask-session-flow';
import type { AskExecution, AskToolArgs } from '../../ask/common';
import type { CommandDef, ProviderConfig, ResolvedProviderEntry } from '../../shared';

const GENERATED_ID = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const TIER1_PROMPT = 'tier1 prompt';

const mocks = vi.hoisted(() => {
  const result = {
    runAskInvocation: vi.fn<() => Promise<AskExecution>>(),
    randomUUID: vi.fn<() => string>(),
    createOrGet: vi.fn(),
    getNativeSessionId: vi.fn<() => string | undefined>(),
    getPrependContext: vi.fn<() => string>(),
    buildSessionPrompt: vi.fn<() => string>(),
  };

  return result;
});

vi.mock('node:crypto', () => {
  const result = { randomUUID: mocks.randomUUID };

  return result;
});

vi.mock('../../ask/domain-logic/ask-runner', () => {
  const result = { runAskInvocation: mocks.runAskInvocation };

  return result;
});

vi.mock('../utils/session-context.util', () => {
  const result = { buildSessionPrompt: mocks.buildSessionPrompt };

  return result;
});

vi.mock('../data-access', () => {
  const sessionStore = {
    createOrGet: mocks.createOrGet,
    getNativeSessionId: mocks.getNativeSessionId,
    getPrependContext: mocks.getPrependContext,
  };
  const result = Object.fromEntries([['SESSION_STORE', sessionStore]]);

  return result;
});

const createContext = (flags: CommandDef['flags']): ResolvedProviderEntry => {
  const sessions: CommandDef = { flags };
  const ask = { args: [] };
  const commands = { ask, sessions };
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
  const result: ResolvedProviderEntry = { name: 'test-provider', binaryPath: '/usr/bin/test-cli', config };

  return result;
};

const createExecution = (nativeSessionId?: string): AskExecution => {
  const content: TextContent[] = [{ type: 'text', text: 'ok' }];
  const response: CallToolResult = { content };
  const result: AskExecution = {
    response,
    sessionMode: 'none',
    responseText: 'ok',
    nativeSessionId,
    wasCancelled: false,
  };

  return result;
};

const START_CONTEXT = createContext({ resume: ['--resume'], startWithId: '--session-id=' });
const RESUME_ONLY_CONTEXT = createContext({ resume: ['--resume'] });
const ARGS: AskToolArgs = { prompt: 'hello', session_id: 'agentic-session' };

describe('FEATURE: session flow with a caller-chosen native session id', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.randomUUID.mockReturnValue(GENERATED_ID);
    mocks.getNativeSessionId.mockReturnValue(undefined);
    mocks.getPrependContext.mockReturnValue('');
    mocks.buildSessionPrompt.mockReturnValue(TIER1_PROMPT);
  });

  describe('GIVEN a provider with a startWithId flag and a new session', () => {
    it('WHEN building the flow state THEN a generated id is set as the start session id', () => {
      const state = buildSessionFlowState(START_CONTEXT, ARGS);

      expect(state).toStrictEqual({
        sessionId: 'agentic-session',
        prompt: TIER1_PROMPT,
        mode: 'tier1-prepend',
        startSessionId: GENERATED_ID,
      });
    });

    it('WHEN executing the flow THEN the start session id is passed to the invocation', async () => {
      const state = buildSessionFlowState(START_CONTEXT, ARGS);

      mocks.runAskInvocation.mockResolvedValue(createExecution());

      await executeSessionFlow({ context: START_CONTEXT, args: ARGS, state });

      expect(mocks.runAskInvocation).toHaveBeenCalledWith(
        expect.objectContaining({ startSessionId: GENERATED_ID, tier2SessionId: undefined })
      );
    });

    it('WHEN the CLI output carries no session id THEN the start session id becomes the native id', async () => {
      const state = buildSessionFlowState(START_CONTEXT, ARGS);

      mocks.runAskInvocation.mockResolvedValue(createExecution());

      const result = await executeSessionFlow({ context: START_CONTEXT, args: ARGS, state });

      expect(result.nativeSessionId).toBe(GENERATED_ID);
    });

    it('WHEN the CLI output text looks like another session id THEN the start session id still wins', async () => {
      const state = buildSessionFlowState(START_CONTEXT, ARGS);

      mocks.runAskInvocation.mockResolvedValue(createExecution('text-lookalike'));

      const result = await executeSessionFlow({ context: START_CONTEXT, args: ARGS, state });

      expect(result.nativeSessionId).toBe(GENERATED_ID);
    });
  });

  it('GIVEN a provider with a startWithId flag and a stored native id WHEN building the flow state THEN it resumes without a new id', () => {
    mocks.getNativeSessionId.mockReturnValue(GENERATED_ID);

    const state = buildSessionFlowState(START_CONTEXT, ARGS);

    expect(state).toStrictEqual({
      sessionId: 'agentic-session',
      prompt: 'hello',
      nativeSessionId: GENERATED_ID,
      mode: 'tier2-native',
    });
  });

  describe('GIVEN a provider without a startWithId flag', () => {
    it('WHEN building the flow state THEN no start session id is set', () => {
      const state = buildSessionFlowState(RESUME_ONLY_CONTEXT, ARGS);

      expect(state).toStrictEqual({ sessionId: 'agentic-session', prompt: TIER1_PROMPT, mode: 'tier1-prepend' });
    });

    it('WHEN executing the flow THEN the native id comes from the CLI output', async () => {
      const state = buildSessionFlowState(RESUME_ONLY_CONTEXT, ARGS);

      mocks.runAskInvocation.mockResolvedValue(createExecution('extracted-id'));

      const result = await executeSessionFlow({ context: RESUME_ONLY_CONTEXT, args: ARGS, state });

      expect(result.nativeSessionId).toBe('extracted-id');
    });
  });
});
