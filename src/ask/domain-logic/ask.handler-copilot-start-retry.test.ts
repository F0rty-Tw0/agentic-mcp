import fs from 'node:fs/promises';

import type { CallToolResult } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAsk } from './ask.handler';
import type { ResolvedProviderEntry } from '../../shared/provider/common';
import type { AskedTurn } from '../test/common/fake-copilot.type';
import {
  askFakeCopilotTurn,
  createFakeCopilotContext,
  createFakeCopilotRunLog,
  hasStartFlag,
  readPromptArg,
  uniqueCopilotSessionId,
} from '../test/utils/fake-copilot.spec.util';

type StartTurns = {
  readonly firstTurn: AskedTurn;
  readonly secondTurn: AskedTurn;
};

let runLogDir = '';
let runLogPath = '';

const askInSession = async (context: ResolvedProviderEntry, sessionId: string, prompt: string): Promise<AskedTurn> => {
  const runAsk = async (): Promise<CallToolResult> => handleAsk(context, { prompt, session_id: sessionId });
  const askedTurn = await askFakeCopilotTurn(runAsk, runLogPath);

  return askedTurn;
};

const askRejectedStartTurns = async (): Promise<StartTurns> => {
  vi.stubEnv('FAKE_COPILOT_REJECT_SESSION_ID', '1');

  const context = await createFakeCopilotContext();
  const sessionId = uniqueCopilotSessionId();
  const firstTurn = await askInSession(context, sessionId, 'remember teal');
  const secondTurn = await askInSession(context, sessionId, 'which word?');
  const turns: StartTurns = { firstTurn, secondTurn };

  return turns;
};

const askFailedStartTurns = async (): Promise<StartTurns> => {
  vi.stubEnv('FAKE_COPILOT_FAIL_RUN', '1');

  const context = await createFakeCopilotContext();
  const sessionId = uniqueCopilotSessionId();
  const firstTurn = await askInSession(context, sessionId, 'remember teal');

  vi.stubEnv('FAKE_COPILOT_FAIL_RUN', '');

  const secondTurn = await askInSession(context, sessionId, 'which word?');
  const turns: StartTurns = { firstTurn, secondTurn };

  return turns;
};

describe('FEATURE: copilot session start-flag retry against a fake copilot CLI', () => {
  beforeEach(async () => {
    const runLog = await createFakeCopilotRunLog();

    runLogDir = runLog.dir;
    runLogPath = runLog.path;
    vi.stubEnv('FAKE_COPILOT_RUN_LOG', runLogPath);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await fs.rm(runLogDir, { recursive: true, force: true });
  });

  describe('GIVEN a copilot that rejects --session-id as an unknown option', () => {
    it('WHEN the first ask runs THEN it succeeds', async () => {
      const { firstTurn } = await askRejectedStartTurns();

      expect(firstTurn.result.isError).toBeFalsy();
    });

    it('WHEN the first ask runs THEN copilot runs once with the start flag and once without it', async () => {
      const { firstTurn } = await askRejectedStartTurns();

      const startFlags = firstTurn.runs.map(hasStartFlag);

      expect(startFlags).toStrictEqual([true, false]);
    });

    it('WHEN the second turn runs THEN copilot runs once without the start flag', async () => {
      const { secondTurn } = await askRejectedStartTurns();

      const startFlags = secondTurn.runs.map(hasStartFlag);

      expect(startFlags).toStrictEqual([false]);
    });

    it('WHEN the second turn runs THEN the prompt replays the first turn', async () => {
      const { secondTurn } = await askRejectedStartTurns();

      const prompt = secondTurn.runs.map(readPromptArg).join('\n');

      expect(prompt).toContain('user: remember teal');
    });
  });

  describe('GIVEN a copilot whose start run fails with an error that is not a flag rejection', () => {
    it('WHEN the first ask runs THEN the error is returned', async () => {
      const { firstTurn } = await askFailedStartTurns();

      expect(firstTurn.result.isError).toBe(true);
    });

    it('WHEN the first ask runs THEN copilot runs exactly once, with the start flag', async () => {
      const { firstTurn } = await askFailedStartTurns();

      const startFlags = firstTurn.runs.map(hasStartFlag);

      expect(startFlags).toStrictEqual([true]);
    });

    it('WHEN the second turn runs THEN copilot still gets the start flag', async () => {
      const { secondTurn } = await askFailedStartTurns();

      const startFlags = secondTurn.runs.map(hasStartFlag);

      expect(startFlags).toStrictEqual([true]);
    });
  });
});
