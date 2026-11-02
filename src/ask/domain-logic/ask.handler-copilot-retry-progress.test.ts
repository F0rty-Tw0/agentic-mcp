import fs from 'node:fs/promises';

import type { ServerNotification } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { handleAsk } from './ask.handler';
import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { ResolvedProviderEntry } from '../../shared/provider/common';
import {
  createFakeCopilotContext,
  createFakeCopilotRunLog,
  readFakeCopilotRuns,
  readStartedId,
  uniqueCopilotSessionId,
} from '../test/utils/fake-copilot.spec.util';

type ProgressParams = {
  readonly progress: number;
  readonly message: string;
};

type StreamEventIds = {
  readonly streamId: string;
  readonly sequence: number;
};

const PROGRESS_NOTIFICATION_SCHEMA = z.object({
  method: z.literal('notifications/progress'),
  params: z.object({ progress: z.number(), message: z.string() }),
});

const STREAM_EVENT_IDS_SCHEMA = z.object({ streamId: z.string(), sequence: z.number() });

const STREAM_EVENT_TYPE_SCHEMA = z.object({ type: z.string() });

const RETRIED_RUN_COUNT = 2;

let runLogDir = '';
let runLogPath = '';

const askTurn = async (
  context: ResolvedProviderEntry,
  sessionId: string,
  streamLive: boolean
): Promise<ProgressParams[]> => {
  const progressParams: ProgressParams[] = [];
  const sendNotification = async (notification: ServerNotification): Promise<void> => {
    const { params } = PROGRESS_NOTIFICATION_SCHEMA.parse(notification);

    progressParams.push(params);
    await Promise.resolve();
  };
  const meta = { progressToken: 'progress-1' };
  const extra: ProgressContext = { sendNotification, ['_meta']: meta };

  await handleAsk(context, { prompt: 'remember teal', session_id: sessionId, stream_live: streamLive }, extra);

  return progressParams;
};

const readStreamEventIds = (params: ProgressParams): StreamEventIds => {
  const parsed: unknown = JSON.parse(params.message);
  const eventIds = STREAM_EVENT_IDS_SCHEMA.parse(parsed);

  return eventIds;
};

const readProgressValues = (progressParams: ProgressParams[]): number[] => {
  const progressValues = progressParams.map((params) => params.progress);

  return progressValues;
};

const readSequences = (progressParams: ProgressParams[]): number[] => {
  const sequences = progressParams.map((params) => readStreamEventIds(params).sequence);

  return sequences;
};

const readStreamIds = (progressParams: ProgressParams[]): string[] => {
  const streamIds = progressParams.map((params) => readStreamEventIds(params).streamId);
  const streamIdSet = new Set(streamIds);
  const distinctStreamIds = [...streamIdSet];

  return distinctStreamIds;
};

const isStartEvent = (params: ProgressParams): boolean => {
  const parsed: unknown = JSON.parse(params.message);
  const { type } = STREAM_EVENT_TYPE_SCHEMA.parse(parsed);
  const result = type === 'start';

  return result;
};

const countStartEvents = (progressParams: ProgressParams[]): number => {
  const startEvents = progressParams.filter(isStartEvent);
  const startEventCount = startEvents.length;

  return startEventCount;
};

const toStrictlyIncreasing = (values: number[]): number[] => {
  const valueSet = new Set(values);
  const distinctValues = [...valueSet];
  const increasingValues = distinctValues.toSorted((left, right) => left - right);

  return increasingValues;
};

const askRejectedStartTurn = async (streamLive = true): Promise<ProgressParams[]> => {
  vi.stubEnv('FAKE_COPILOT_REJECT_SESSION_ID', '1');

  const context = await createFakeCopilotContext();
  const progressParams = await askTurn(context, uniqueCopilotSessionId(), streamLive);

  return progressParams;
};

const askRejectedStartFailedRerunTurn = async (): Promise<ProgressParams[]> => {
  vi.stubEnv('FAKE_COPILOT_FAIL_RUN', '1');

  const progressParams = await askRejectedStartTurn();

  return progressParams;
};

const askLostSessionTurn = async (): Promise<ProgressParams[]> => {
  const context = await createFakeCopilotContext();
  const sessionId = uniqueCopilotSessionId();

  await askTurn(context, sessionId, true);

  const [firstRun] = await readFakeCopilotRuns(runLogPath);

  vi.stubEnv('FAKE_COPILOT_LOST_SESSION', readStartedId(firstRun) ?? '');

  const progressParams = await askTurn(context, sessionId, true);

  return progressParams;
};

describe('FEATURE: copilot session retries keep one progress stream per tool call', () => {
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

  describe('GIVEN a copilot that rejects --session-id and succeeds on the rerun without it', () => {
    it('WHEN the ask streams THEN every event carries one stream id', async () => {
      const progressParams = await askRejectedStartTurn();

      expect(readStreamIds(progressParams)).toHaveLength(1);
    });

    it('WHEN the ask streams THEN the progress values strictly increase', async () => {
      const progressParams = await askRejectedStartTurn();
      const progressValues = readProgressValues(progressParams);

      expect(countStartEvents(progressParams)).toBe(RETRIED_RUN_COUNT);
      expect(progressValues).toStrictEqual(toStrictlyIncreasing(progressValues));
    });

    it('WHEN the ask streams THEN the event sequence strictly increases', async () => {
      const progressParams = await askRejectedStartTurn();
      const sequences = readSequences(progressParams);

      expect(countStartEvents(progressParams)).toBe(RETRIED_RUN_COUNT);
      expect(sequences).toStrictEqual(toStrictlyIncreasing(sequences));
    });

    it('WHEN the ask does not stream THEN the rerun sends no second heartbeat at progress 0', async () => {
      const progressValues = readProgressValues(await askRejectedStartTurn(false));

      expect(progressValues).toStrictEqual([0]);
    });
  });

  describe('GIVEN a copilot that rejects --session-id and also fails the rerun without it', () => {
    it('WHEN the ask streams THEN every event carries one stream id', async () => {
      const progressParams = await askRejectedStartFailedRerunTurn();

      expect(readStreamIds(progressParams)).toHaveLength(1);
    });

    it('WHEN the ask streams THEN the progress values strictly increase', async () => {
      const progressParams = await askRejectedStartFailedRerunTurn();
      const progressValues = readProgressValues(progressParams);

      expect(countStartEvents(progressParams)).toBe(RETRIED_RUN_COUNT);
      expect(progressValues).toStrictEqual(toStrictlyIncreasing(progressValues));
    });
  });

  describe('GIVEN a copilot that lost the native session and succeeds on the replay', () => {
    it('WHEN the follow-up streams THEN every event carries one stream id', async () => {
      const progressParams = await askLostSessionTurn();

      expect(readStreamIds(progressParams)).toHaveLength(1);
    });

    it('WHEN the follow-up streams THEN the progress values strictly increase', async () => {
      const progressParams = await askLostSessionTurn();
      const progressValues = readProgressValues(progressParams);

      expect(countStartEvents(progressParams)).toBe(RETRIED_RUN_COUNT);
      expect(progressValues).toStrictEqual(toStrictlyIncreasing(progressValues));
    });
  });
});
