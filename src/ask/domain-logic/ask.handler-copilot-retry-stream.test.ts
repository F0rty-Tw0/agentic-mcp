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

let runLogDir = '';
let runLogPath = '';

const STREAM_EVENT_SCHEMA = z.object({ type: z.string() });

const readProgressMessage = (notification: ServerNotification): string => {
  if (notification.method !== 'notifications/progress') return '{}';

  const message = notification.params.message ?? '{}';

  return message;
};

const readEventType = (notification: ServerNotification): string => {
  const message = readProgressMessage(notification);
  const parsed: unknown = JSON.parse(message);
  const event = STREAM_EVENT_SCHEMA.parse(parsed);

  return event.type;
};

const askStreamingTurn = async (
  context: ResolvedProviderEntry,
  sessionId: string,
  prompt: string
): Promise<string[]> => {
  const eventTypes: string[] = [];
  const sendNotification = async (notification: ServerNotification): Promise<void> => {
    eventTypes.push(readEventType(notification));
    await Promise.resolve();
  };
  const meta = { progressToken: 'progress-1' };
  const extra: ProgressContext = { sendNotification, ['_meta']: meta };

  await handleAsk(context, { prompt, session_id: sessionId, stream_live: true }, extra);

  return eventTypes;
};

const askRejectedStartStream = async (): Promise<string[]> => {
  vi.stubEnv('FAKE_COPILOT_REJECT_SESSION_ID', '1');

  const context = await createFakeCopilotContext();
  const eventTypes = await askStreamingTurn(context, uniqueCopilotSessionId(), 'remember teal');

  return eventTypes;
};

const askLostSessionStream = async (): Promise<string[]> => {
  const context = await createFakeCopilotContext();
  const sessionId = uniqueCopilotSessionId();

  await askStreamingTurn(context, sessionId, 'remember teal');

  const [firstRun] = await readFakeCopilotRuns(runLogPath);

  vi.stubEnv('FAKE_COPILOT_LOST_SESSION', readStartedId(firstRun) ?? '');

  const eventTypes = await askStreamingTurn(context, sessionId, 'which word?');

  return eventTypes;
};

const askFailedStartStream = async (): Promise<string[]> => {
  vi.stubEnv('FAKE_COPILOT_FAIL_RUN', '1');

  const context = await createFakeCopilotContext();
  const eventTypes = await askStreamingTurn(context, uniqueCopilotSessionId(), 'remember teal');

  return eventTypes;
};

describe('FEATURE: copilot session retries streamed live against a fake copilot CLI', () => {
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
    it('WHEN the ask streams THEN no error event is sent', async () => {
      const eventTypes = await askRejectedStartStream();

      expect(eventTypes).not.toContain('error');
    });

    it('WHEN the ask streams THEN the last event is done', async () => {
      const eventTypes = await askRejectedStartStream();

      expect(eventTypes.at(-1)).toBe('done');
    });

    it('WHEN the ask streams THEN the rejected run and the rerun each send their output chunk', async () => {
      const eventTypes = await askRejectedStartStream();

      expect(eventTypes).toStrictEqual(['start', 'chunk', 'start', 'chunk', 'done']);
    });
  });

  describe('GIVEN a copilot that lost the native session and succeeds on the replay', () => {
    it('WHEN the follow-up streams THEN no error event is sent', async () => {
      const eventTypes = await askLostSessionStream();

      expect(eventTypes).not.toContain('error');
    });

    it('WHEN the follow-up streams THEN the last event is done', async () => {
      const eventTypes = await askLostSessionStream();

      expect(eventTypes.at(-1)).toBe('done');
    });
  });

  describe('GIVEN a copilot whose start run fails with an error that is not a flag rejection', () => {
    it('WHEN the ask streams THEN the last event is error', async () => {
      const eventTypes = await askFailedStartStream();

      expect(eventTypes.at(-1)).toBe('error');
    });
  });
});
