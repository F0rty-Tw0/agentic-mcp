import type { CallToolResult } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAskAll } from './ask-all.handler';
import { handleAsk } from '../../ask/domain-logic/ask.handler';
import type { ResolvedProviderEntry } from '../../shared';
import { createSemaphore } from '../../shared';
import type { AskAllToolArgs } from '../common';
import { makeProvider, makeSuccessResult, parseResult } from '../test/utils/ask-all-handler.spec.util';

vi.mock('../../ask/domain-logic/ask.handler', () => {
  const result = { handleAsk: vi.fn() };

  return result;
});

const ASK_ALL_ARGS: AskAllToolArgs = { prompt: 'review this PR' };
const GLOBAL_SPAWN_CAP = 5;
const LEG_DURATION_MS = 20_000;
const LEG_TIMEOUT_MS = 30_000;
const PROVIDER_NAMES = ['claude', 'codex', 'copilot', 'gemini', 'opencode', 'goose'];

type ConcurrencyProbe = {
  // eslint-disable-next-line local/readonly-type-properties -- counted in place by the mocked asks
  running: number;
  // eslint-disable-next-line local/readonly-type-properties -- raised in place by the mocked asks
  peak: number;
};

const buildProviders = (): ResolvedProviderEntry[] => {
  const providers = PROVIDER_NAMES.map((name) => makeProvider(name, { timeout: LEG_TIMEOUT_MS }));

  return providers;
};

const mockTimedAsks = (probe: ConcurrencyProbe): void => {
  const globalSpawnSlots = createSemaphore(GLOBAL_SPAWN_CAP);

  vi.mocked(handleAsk).mockImplementation(async (provider): Promise<CallToolResult> => {
    probe.running += 1;
    probe.peak = Math.max(probe.peak, probe.running);
    await globalSpawnSlots.acquireSlot();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, LEG_DURATION_MS);
    });
    globalSpawnSlots.releaseSlot();
    probe.running -= 1;

    const result = makeSuccessResult(`${provider.name} done`);

    return result;
  });
};

describe('FEATURE: ask_all fan-out under the global spawn cap', () => {
  let probe: ConcurrencyProbe;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    probe = { running: 0, peak: 0 };
    mockTimedAsks(probe);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('GIVEN more installed providers than the global spawn cap', () => {
    it('WHEN ask_all runs THEN at most the cap of provider asks are started at once', async () => {
      const resultPromise = handleAskAll(buildProviders(), ASK_ALL_ARGS);

      await vi.advanceTimersByTimeAsync(LEG_DURATION_MS * 2);
      await resultPromise;

      expect(probe.peak).toBe(GLOBAL_SPAWN_CAP);
    });

    it('WHEN the last leg can start only after the first legs finish THEN its timeout counts from its own start and it succeeds', async () => {
      const resultPromise = handleAskAll(buildProviders(), ASK_ALL_ARGS);

      await vi.advanceTimersByTimeAsync(LEG_DURATION_MS * 2);

      const parsed = parseResult(await resultPromise);

      expect(parsed.succeeded).toBe(PROVIDER_NAMES.length);
    });
  });
});
