import type { CallToolResult, TextContent } from '@modelcontextprotocol/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { executeSessionFlow } from './ask-session-flow';
import type { AskExecution, AskToolArgs } from '../../ask/common';
import type { CommandDef, ProviderConfig, ResolvedProviderEntry } from '../../shared/provider/common';
import type { StreamNotifier } from '../../streaming/common';
import type { SessionFlowState } from '../common';
import { createResolvedProviderEntry, createSessionFlowState } from '../test/utils/ask-session-flow.spec.util';

type StreamRun = (streamNotifier: StreamNotifier) => Promise<unknown>;

const mocks = vi.hoisted(() => {
  const streamNotifier: StreamNotifier = {
    onStdoutChunk: vi.fn(),
    onStderrChunk: vi.fn(),
    emitStart: vi.fn(),
    emitDone: vi.fn(),
    emitError: vi.fn(),
    flush: vi.fn(),
    stop: vi.fn(),
    enabled: true,
  };
  const result = {
    streamNotifier,
    runAskInvocation: vi.fn<() => Promise<AskExecution>>(),
    withAskStream: vi.fn(async (_input: unknown, run: StreamRun) => run(streamNotifier)),
  };

  return result;
});

vi.mock('../../ask/domain-logic/ask-runner', () => {
  const result = { runAskInvocation: mocks.runAskInvocation };

  return result;
});

vi.mock('../../ask/domain-logic/ask-stream', () => {
  const result = { withAskStream: mocks.withAskStream };

  return result;
});

vi.mock('../utils/session-context.util', () => {
  const result = { buildSessionPrompt: vi.fn(() => 'tier1 prompt') };

  return result;
});

vi.mock('../data-access', () => {
  const sessionStore = { getPrependContext: vi.fn(() => ''), isNativeStartDisabled: vi.fn(() => false) };
  const result = Object.fromEntries([['SESSION_STORE', sessionStore]]);

  return result;
});

const OK_TEXT: TextContent[] = [{ type: 'text', text: 'ok' }];
const OK_RESPONSE: CallToolResult = { content: OK_TEXT };
const FAILED_RESPONSE: CallToolResult = { content: [], isError: true };
const SUCCESSFUL_EXECUTION: AskExecution = {
  response: OK_RESPONSE,
  sessionMode: 'none',
  responseText: 'ok',
  wasCancelled: false,
};
const FAILED_EXECUTION: AskExecution = { ...SUCCESSFUL_EXECUTION, response: FAILED_RESPONSE };
const ARGS: AskToolArgs = { prompt: 'hello', session_id: 'agentic-session' };
const TIER2_STATE: SessionFlowState = createSessionFlowState({ mode: 'tier2-native', nativeSessionId: 'native-1' });

const START_FLAG_REJECTED_EXECUTION: AskExecution = {
  ...FAILED_EXECUTION,
  stderr: "error: unknown option '--session-id=start-1'",
};
const START_STATE: SessionFlowState = createSessionFlowState({ startSessionId: 'start-1' });

const createStartFlagProviderEntry = (): ResolvedProviderEntry => {
  const baseEntry = createResolvedProviderEntry();
  const flags: CommandDef['flags'] = { startWithId: '--session-id=' };
  const sessions: CommandDef = { flags };
  const commands: ProviderConfig['commands'] = { ...baseEntry.config.commands, sessions };
  const config: ProviderConfig = { ...baseEntry.config, commands };
  const result: ResolvedProviderEntry = { ...baseEntry, config };

  return result;
};

const runLostSessionFlow = async (): Promise<void> => {
  mocks.runAskInvocation.mockResolvedValueOnce(FAILED_EXECUTION).mockResolvedValueOnce(SUCCESSFUL_EXECUTION);

  await executeSessionFlow({ context: createResolvedProviderEntry(), args: ARGS, state: TIER2_STATE });
};

const runStartFlagRerunFlow = async (): Promise<void> => {
  mocks.runAskInvocation.mockResolvedValueOnce(START_FLAG_REJECTED_EXECUTION);
  mocks.runAskInvocation.mockResolvedValueOnce(SUCCESSFUL_EXECUTION);

  await executeSessionFlow({ context: createStartFlagProviderEntry(), args: ARGS, state: START_STATE });
};

describe('FEATURE: session flow live stream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GIVEN a native session the CLI lost and a tier-1 replay', () => {
    it('WHEN the flow runs THEN it opens one stream for the tool call', async () => {
      await runLostSessionFlow();

      expect(mocks.withAskStream).toHaveBeenCalledOnce();
    });

    it('WHEN the flow runs THEN the failed run streams to the tool call stream', async () => {
      await runLostSessionFlow();

      expect(mocks.runAskInvocation).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ streamNotifier: mocks.streamNotifier })
      );
    });

    it('WHEN the flow runs THEN the replay streams to the same tool call stream', async () => {
      await runLostSessionFlow();

      expect(mocks.runAskInvocation).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ streamNotifier: mocks.streamNotifier })
      );
    });
  });

  describe('GIVEN a start run the CLI rejects for the start flag and a rerun without it', () => {
    it('WHEN the flow runs THEN it opens one stream for the tool call', async () => {
      await runStartFlagRerunFlow();

      expect(mocks.withAskStream).toHaveBeenCalledOnce();
    });

    it('WHEN the flow runs THEN the rejected run streams to the tool call stream', async () => {
      await runStartFlagRerunFlow();

      expect(mocks.runAskInvocation).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ streamNotifier: mocks.streamNotifier })
      );
    });

    it('WHEN the flow runs THEN the rerun streams to the same tool call stream', async () => {
      await runStartFlagRerunFlow();

      expect(mocks.runAskInvocation).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ streamNotifier: mocks.streamNotifier })
      );
    });
  });

  describe('GIVEN no prompt', () => {
    it('WHEN the flow runs THEN no stream is opened', async () => {
      const args: AskToolArgs = { session_id: 'agentic-session' };

      await executeSessionFlow({ context: createResolvedProviderEntry(), args, state: TIER2_STATE });

      expect(mocks.withAskStream).not.toHaveBeenCalled();
    });
  });
});
