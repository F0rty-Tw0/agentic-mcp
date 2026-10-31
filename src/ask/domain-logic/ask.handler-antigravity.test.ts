import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { CallToolResult } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';

import { handleAsk } from './ask.handler';
import { providersFileSchema } from '../../shared';
import type { ProviderConfig, ResolvedProviderEntry } from '../../shared/provider/common';
import type { AskToolArgs, AskToolStructuredContent } from '../common';
import { readFirstText } from '../test/utils/text-content.spec.util';

const FAKE_AGY_PATH = fileURLToPath(new URL('../test/fixtures/fake-agy/agy', import.meta.url));
const PROVIDERS_JSON_URL = new URL('../../config/providers.json', import.meta.url);
const FAKE_CONVERSATION_ID = '11a21e91-0000-4000-8000-0000000000aa';
const TEST_TIMEOUT_MS = 20_000;
const HANG_CASE_TIMEOUT_MS = 40_000;

let sessionCounter = 0;

const uniqueSessionId = (): string => {
  sessionCounter += 1;

  const sessionId = `agy-session-${Date.now()}-${sessionCounter}`;

  return sessionId;
};

const readBundledAntigravity = async (): Promise<ProviderConfig> => {
  const content = await fs.readFile(PROVIDERS_JSON_URL, 'utf8');
  const parsedJson: unknown = JSON.parse(content);
  const antigravity = providersFileSchema.parse(parsedJson).providers.antigravity;

  if (!antigravity) throw new Error('Expected the bundled config to define antigravity');

  return antigravity;
};

const createFakeAgyContext = async (): Promise<ResolvedProviderEntry> => {
  const bundled = await readBundledAntigravity();
  const config: ProviderConfig = { ...bundled, timeout: TEST_TIMEOUT_MS, resultExitGraceMs: 500 };
  const context: ResolvedProviderEntry = { name: 'antigravity', binaryPath: FAKE_AGY_PATH, config };

  return context;
};

const askFakeAgy = async (args: AskToolArgs): Promise<CallToolResult> => {
  const context = await createFakeAgyContext();
  const result = await handleAsk(context, args);

  return result;
};

const readAttribution = (result: CallToolResult): AskToolStructuredContent['attribution'] | undefined => {
  const isStructured = (value: unknown): value is AskToolStructuredContent =>
    typeof value === 'object' && value !== null && 'attribution' in value;
  const structuredContent = result.structuredContent;

  if (!isStructured(structuredContent)) return;

  return structuredContent.attribution;
};

const askInOneSession = async (streamLive: boolean): Promise<CallToolResult> => {
  const sessionId = uniqueSessionId();

  await askFakeAgy({ prompt: 'first', session_id: sessionId, stream_live: streamLive });

  const followUp = await askFakeAgy({ prompt: 'second', session_id: sessionId, stream_live: streamLive });

  return followUp;
};

describe('FEATURE: antigravity provider against a fake agy CLI', () => {
  describe('GIVEN the bundled antigravity config in json mode', () => {
    it('WHEN asked THEN the envelope response is the answer', async () => {
      const result = await askFakeAgy({ prompt: 'hello' });

      expect(readFirstText(result)).toBe('agy-fake: hello');
    });

    it('WHEN asked twice in one session THEN the second run resumes the native conversation', async () => {
      const followUp = await askInOneSession(false);

      expect(readFirstText(followUp)).toContain(`(resumed ${FAKE_CONVERSATION_ID})`);
    });
  });

  describe('GIVEN the bundled antigravity config with stream_live', () => {
    it('WHEN asked THEN the nested result event response is the answer', async () => {
      const result = await askFakeAgy({ prompt: 'hello', stream_live: true });

      expect(readFirstText(result)).toBe('agy-fake: hello');
    });

    it('WHEN asked twice in one session THEN the id from the result event is resumed', async () => {
      const followUp = await askInOneSession(true);

      expect(readFirstText(followUp)).toContain(`(resumed ${FAKE_CONVERSATION_ID})`);
    });
  });

  describe('GIVEN an agy run that prints a complete json result and then never exits', () => {
    it(
      'WHEN asked THEN the printed answer is returned as a success',
      async () => {
        const result = await askFakeAgy({ prompt: 'hang' });

        expect(result.isError).toBeUndefined();
        expect(readFirstText(result)).toBe('agy-fake: hang');
      },
      HANG_CASE_TIMEOUT_MS
    );

    it(
      'WHEN asked THEN the run is stopped well before the provider timeout',
      async () => {
        const result = await askFakeAgy({ prompt: 'hang', include_structured: true });
        const attribution = readAttribution(result);

        expect(attribution?.executionTimeMs).toBeLessThan(TEST_TIMEOUT_MS / 2);
      },
      HANG_CASE_TIMEOUT_MS
    );

    it(
      'WHEN asked THEN the attribution warns that agy did not exit',
      async () => {
        const result = await askFakeAgy({ prompt: 'hang', include_structured: true });
        const attribution = readAttribution(result);

        expect(attribution?.warning).toContain('antigravity did not exit');
      },
      HANG_CASE_TIMEOUT_MS
    );
  });

  it(
    'GIVEN an agy stream-json run that prints its result event and then never exits WHEN asked THEN the answer is returned as a success',
    async () => {
      const result = await askFakeAgy({ prompt: 'hang', stream_live: true });

      expect(result.isError).toBeUndefined();
      expect(readFirstText(result)).toBe('agy-fake: hang');
    },
    HANG_CASE_TIMEOUT_MS
  );
});
