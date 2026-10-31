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
  readStartedId,
  uniqueCopilotSessionId,
} from '../test/utils/fake-copilot.spec.util';

type LostSessionTurns = {
  readonly firstStartedId?: string;
  readonly replayStartedId?: string;
  readonly thirdTurnRuns: string[][];
};

let runLogDir = '';
let runLogPath = '';

const askInSession = async (context: ResolvedProviderEntry, sessionId: string, prompt: string): Promise<AskedTurn> => {
  const runAsk = async (): Promise<CallToolResult> => handleAsk(context, { prompt, session_id: sessionId });
  const askedTurn = await askFakeCopilotTurn(runAsk, runLogPath);

  return askedTurn;
};

const askLostSessionTurns = async (): Promise<LostSessionTurns> => {
  const context = await createFakeCopilotContext();
  const sessionId = uniqueCopilotSessionId();
  const firstTurn = await askInSession(context, sessionId, 'remember teal');
  const firstStartedId = readStartedId(firstTurn.runs[0]);

  vi.stubEnv('FAKE_COPILOT_LOST_SESSION', firstStartedId ?? '');

  const secondTurn = await askInSession(context, sessionId, 'which word?');
  const thirdTurn = await askInSession(context, sessionId, 'and again?');
  const turns: LostSessionTurns = {
    firstStartedId,
    replayStartedId: readStartedId(secondTurn.runs[1]),
    thirdTurnRuns: thirdTurn.runs,
  };

  return turns;
};

describe('FEATURE: copilot session whose native session was lost, against a fake copilot CLI', () => {
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

  describe('GIVEN copilot fails to resume the id the first ask started', () => {
    it('WHEN the follow-up falls back to replay THEN the replay starts a new native session id', async () => {
      const { firstStartedId, replayStartedId } = await askLostSessionTurns();

      expect(replayStartedId).toMatch(/^[0-9a-f-]{36}$/);
      expect(replayStartedId).not.toBe(firstStartedId);
    });

    it('WHEN the next turn runs THEN copilot runs once', async () => {
      const { thirdTurnRuns } = await askLostSessionTurns();

      expect(thirdTurnRuns).toHaveLength(1);
    });

    it('WHEN the next turn runs THEN it resumes the new id', async () => {
      const { replayStartedId, thirdTurnRuns } = await askLostSessionTurns();

      const [thirdRun] = thirdTurnRuns;

      expect(thirdRun?.slice(-2)).toStrictEqual(['--resume', replayStartedId]);
    });
  });
});
