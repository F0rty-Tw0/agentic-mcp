import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CallToolResult } from '@modelcontextprotocol/server';

import { providersFileSchema } from '../../../shared';
import type { ProviderConfig, ResolvedProviderEntry } from '../../../shared/provider/common';
import type { AskedTurn, FakeCopilotRunLog } from '../common/fake-copilot.type';

const FAKE_COPILOT_PATH = fileURLToPath(new URL('../fixtures/fake-copilot/copilot', import.meta.url));
const PROVIDERS_JSON_URL = new URL('../../../config/providers.json', import.meta.url);
const TEST_TIMEOUT_MS = 20_000;
const SESSION_ID_PREFIX = '--session-id=';

let sessionCounter = 0;

export const FAKE_COPILOT_ENV_KEYS = [
  'FAKE_COPILOT_RUN_LOG',
  'FAKE_COPILOT_LOST_SESSION',
  'FAKE_COPILOT_REJECT_SESSION_ID',
];

export const createFakeCopilotContext = async (): Promise<ResolvedProviderEntry> => {
  const content = await fs.readFile(PROVIDERS_JSON_URL, 'utf8');
  const parsedJson: unknown = JSON.parse(content);
  const bundled = providersFileSchema.parse(parsedJson).providers.copilot;

  if (!bundled) throw new Error('Expected the bundled config to define copilot');

  const config: ProviderConfig = { ...bundled, timeout: TEST_TIMEOUT_MS, envPassthrough: FAKE_COPILOT_ENV_KEYS };
  const context: ResolvedProviderEntry = { name: 'copilot', binaryPath: FAKE_COPILOT_PATH, config };

  return context;
};

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const parseArgvLine = (line: string): string[] => {
  const parsed: unknown = JSON.parse(line);

  if (!isStringArray(parsed)) throw new Error(`fake copilot run log has a bad line: ${line}`);

  return parsed;
};

export const readFakeCopilotRuns = async (runLogPath: string): Promise<string[][]> => {
  const content = await fs.readFile(runLogPath, 'utf8').catch(() => '');
  const lines = content.split('\n').filter(Boolean);
  const runs = lines.map(parseArgvLine);

  return runs;
};

export const createFakeCopilotRunLog = async (): Promise<FakeCopilotRunLog> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fake-copilot-runs-'));
  const runLog: FakeCopilotRunLog = { dir, path: path.join(dir, 'runs.jsonl') };

  return runLog;
};

export const uniqueCopilotSessionId = (): string => {
  sessionCounter += 1;

  const sessionId = `copilot-session-${Date.now()}-${sessionCounter}`;

  return sessionId;
};

export const readStartedId = (argv: string[] = []): string | undefined => {
  const startArg = argv.find((arg) => arg.startsWith(SESSION_ID_PREFIX));
  const startedId = startArg?.slice(SESSION_ID_PREFIX.length);

  return startedId;
};

export const hasStartFlag = (argv: string[]): boolean => argv.some((arg) => arg.startsWith(SESSION_ID_PREFIX));

export const readPromptArg = (argv: string[]): string | undefined => {
  const promptIndex = argv.indexOf('-p');
  const prompt = argv[promptIndex + 1];

  return prompt;
};

export const askFakeCopilotTurn = async (
  runAsk: () => Promise<CallToolResult>,
  runLogPath: string
): Promise<AskedTurn> => {
  const runsBefore = await readFakeCopilotRuns(runLogPath);
  const result = await runAsk();
  const runsAfter = await readFakeCopilotRuns(runLogPath);
  const askedTurn: AskedTurn = { result, runs: runsAfter.slice(runsBefore.length) };

  return askedTurn;
};
