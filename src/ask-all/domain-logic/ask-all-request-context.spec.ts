import type { CallToolResult } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAskAll } from './ask-all.handler';
import type { AskToolArgs } from '../../ask/common';
import { handleAsk } from '../../ask/domain-logic/ask.handler';
import { GLOBAL_MAX_CONCURRENT_SPAWNS } from '../../shared';
import type { ProgressContext, ResolvedProviderEntry } from '../../shared';
import type { AskAllToolArgs } from '../common';
import { makeErrorResult, makeProvider, makeSuccessResult } from '../test/utils/ask-all-handler.spec.util';

vi.mock('../../ask/domain-logic/ask.handler', () => {
  const result = { handleAsk: vi.fn() };

  return result;
});

const CLIENT_TOKEN = 'client-token';
const ASK_ALL_ARGS: AskAllToolArgs = { prompt: 'hello' };
const LEG_CAP_PROVIDER_NAMES = ['claude', 'codex', 'copilot', 'gemini', 'opencode', 'goose', 'aider'];

const createCallerContext = (signal?: AbortSignal): ProgressContext => {
  const sendNotification = vi.fn(async (): Promise<void> => {
    await Promise.resolve();
  });
  const progressMeta = { progressToken: CLIENT_TOKEN };
  const callerContext: ProgressContext = {
    sendNotification,
    ['_meta']: progressMeta,
    signal,
  };

  return callerContext;
};

const isSignalAborted = (providerContext?: ProgressContext): boolean => providerContext?.signal?.aborted === true;

const resolveOnAbort = async (
  provider: ResolvedProviderEntry,
  args: AskToolArgs,
  extra?: ProgressContext
): Promise<CallToolResult> => {
  const cancelled = makeErrorResult(`${provider.name} cancelled: ${args.prompt ?? ''}`);

  const alreadyAborted = isSignalAborted(extra);

  if (alreadyAborted) return cancelled;

  const result = await new Promise<CallToolResult>((resolve) => {
    extra?.signal?.addEventListener('abort', () => resolve(cancelled), { once: true });
  });

  return result;
};

const readProviderContext = (callIndex: number): ProgressContext | undefined => {
  const call = vi.mocked(handleAsk).mock.calls[callIndex];
  const providerContext = call?.[2];

  return providerContext;
};

const countProviderAsks = (): number => vi.mocked(handleAsk).mock.calls.length;

const waitForProviderAsks = async (count: number): Promise<void> => {
  await vi.waitFor(() => {
    expect(countProviderAsks()).toBe(count);
  });
};

const readProviderSignalStates = (): boolean[] => {
  const calls = vi.mocked(handleAsk).mock.calls;
  const states = calls.map((call) => isSignalAborted(call[2]));

  return states;
};

describe('handleAskAll request context', () => {
  let claude: ResolvedProviderEntry;
  let codex: ResolvedProviderEntry;

  beforeEach(() => {
    vi.clearAllMocks();
    claude = makeProvider('claude');
    codex = makeProvider('codex');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('cancellation', () => {
    it('GIVEN providers still running WHEN the caller signal aborts THEN every provider signal aborts', async () => {
      const controller = new AbortController();
      const extra = createCallerContext(controller.signal);

      vi.mocked(handleAsk).mockImplementation(resolveOnAbort);

      const asked = handleAskAll([claude, codex], ASK_ALL_ARGS, extra);

      await waitForProviderAsks(2);
      controller.abort();

      expect(readProviderSignalStates()).toStrictEqual([true, true]);

      await asked;
    });

    it('GIVEN a caller signal that is already aborted WHEN ask_all starts THEN no provider is asked', async () => {
      const controller = new AbortController();
      const extra = createCallerContext(controller.signal);

      controller.abort();
      vi.mocked(handleAsk).mockResolvedValue(makeSuccessResult('ok'));

      await handleAskAll([claude, codex], ASK_ALL_ARGS, extra);

      expect(countProviderAsks()).toBe(0);
    });

    it('GIVEN legs waiting for the ask_all spawn cap WHEN the caller signal aborts THEN no waiting leg asks its provider', async () => {
      const controller = new AbortController();
      const extra = createCallerContext(controller.signal);
      const providers = LEG_CAP_PROVIDER_NAMES.map((name) => makeProvider(name));

      vi.mocked(handleAsk).mockImplementation(resolveOnAbort);

      const asked = handleAskAll(providers, ASK_ALL_ARGS, extra);

      await waitForProviderAsks(GLOBAL_MAX_CONCURRENT_SPAWNS);
      controller.abort();
      await asked;

      expect(countProviderAsks()).toBe(GLOBAL_MAX_CONCURRENT_SPAWNS);
    });
  });

  describe('progress', () => {
    it('GIVEN a client progressToken WHEN ask_all runs THEN a heartbeat goes to the caller with the client token', async () => {
      const extra = createCallerContext();
      const params = { progressToken: CLIENT_TOKEN, progress: 0, message: 'Processing… (0s elapsed)' };
      const heartbeat = { method: 'notifications/progress', params };

      vi.mocked(handleAsk).mockResolvedValue(makeSuccessResult('ok'));

      await handleAskAll([claude, codex], ASK_ALL_ARGS, extra);

      expect(extra.sendNotification).toHaveBeenCalledWith(heartbeat);
    });

    it('GIVEN ask_all has finished WHEN 60s elapse THEN no further heartbeat is sent', async () => {
      vi.useFakeTimers();

      const extra = createCallerContext();

      vi.mocked(handleAsk).mockResolvedValue(makeSuccessResult('ok'));

      await handleAskAll([claude, codex], ASK_ALL_ARGS, extra);
      vi.mocked(extra.sendNotification).mockClear();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(extra.sendNotification).not.toHaveBeenCalled();
    });

    it('GIVEN a client progressToken WHEN providers are asked THEN no provider receives the client token', async () => {
      const extra = createCallerContext();

      vi.mocked(handleAsk).mockResolvedValue(makeSuccessResult('ok'));

      await handleAskAll([claude, codex], ASK_ALL_ARGS, extra);

      const providerContext = readProviderContext(0);

      expect(providerContext).not.toHaveProperty('_meta.progressToken');
    });
  });
});
