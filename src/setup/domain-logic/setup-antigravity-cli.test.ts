/**
 * Integration test — runs the built `agentic-mcp setup --client antigravity` against a scratch HOME.
 * Never touches the real home: HOME points at a fresh temp directory for every case.
 *
 * Uses `.test` extension to distinguish from unit `.spec` files.
 * Run with: pnpm run build && pnpm run test:integration
 */

import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const BINARY_PATH = 'dist/index.js';
const TIMEOUT_MS = 30_000;

const DOCS_SERVER = { command: 'docs-mcp', args: ['--stdio'] };

const SEEDED_AGENTIC_ENTRY = { command: 'npx', args: ['-y', 'agentic-mcp'], enabledTools: ['ask_claude'] };

const SEEDED_SERVERS = { docs: DOCS_SERVER, 'agentic-mcp': SEEDED_AGENTIC_ENTRY };

const SEEDED_CONFIG = { theme: 'dark', mcpServers: SEEDED_SERVERS };

const EXPECTED_AGENTIC_ENTRY = { ...SEEDED_AGENTIC_ENTRY, timeoutSeconds: 4260 };

const EXPECTED_SERVERS = { docs: DOCS_SERVER, 'agentic-mcp': EXPECTED_AGENTIC_ENTRY };

const EXPECTED_CONFIG = { theme: 'dark', mcpServers: EXPECTED_SERVERS };

let homeDirectory: string;
let configPath: string;

const runAntigravitySetup = async (extraArgs: string[] = ['--yes']): Promise<string> => {
  const childEnv = { PATH: process.env.PATH, HOME: homeDirectory };
  const setupArgs = [BINARY_PATH, 'setup', '--client', 'antigravity', ...extraArgs];
  const result = await execFileAsync(process.execPath, setupArgs, { env: childEnv });

  return result.stdout;
};

const readWrittenConfig = async (): Promise<unknown> => {
  const content = await readFile(configPath, 'utf8');
  const parsed: unknown = JSON.parse(content);

  return parsed;
};

const listConfigDirectory = async (): Promise<string[]> => {
  const entries = await readdir(path.dirname(configPath));

  return entries;
};

const readModifiedTime = async (): Promise<number> => {
  const details = await stat(configPath);

  return details.mtimeMs;
};

beforeEach(async () => {
  homeDirectory = await mkdtemp(path.join(os.tmpdir(), 'setup-antigravity-'));
  configPath = path.join(homeDirectory, '.gemini', 'config', 'mcp_config.json');

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(SEEDED_CONFIG, null, 2), 'utf8');
});

afterEach(async () => {
  await rm(homeDirectory, { recursive: true, force: true });
});

describe('FEATURE: built setup CLI for Antigravity', () => {
  describe('GIVEN a scratch HOME with mcp_config.json holding another server and user keys', () => {
    it(
      'WHEN setup --client antigravity --yes runs THEN the file keeps them and agentic-mcp gets timeoutSeconds',
      async () => {
        await runAntigravitySetup();

        const writtenConfig = await readWrittenConfig();

        expect(writtenConfig).toStrictEqual(EXPECTED_CONFIG);
      },
      TIMEOUT_MS
    );

    it(
      'WHEN setup runs a second time THEN the file reads back the same and the timeout is kept',
      async () => {
        await runAntigravitySetup();
        const firstContent = await readFile(configPath, 'utf8');

        const secondStdout = await runAntigravitySetup();
        const secondContent = await readFile(configPath, 'utf8');

        expect(secondContent).toBe(firstContent);
        expect(secondStdout).toContain('agentic-mcp timeoutSeconds: kept your 4260 (not lower than 4260).');
      },
      TIMEOUT_MS
    );

    it(
      'WHEN setup reruns without --yes and without a terminal THEN it reports unchanged and touches no file',
      async () => {
        await runAntigravitySetup();
        const firstModifiedTime = await readModifiedTime();
        const firstEntries = await listConfigDirectory();

        const rerunStdout = await runAntigravitySetup(['--output', 'json']);
        const rerunModifiedTime = await readModifiedTime();
        const rerunEntries = await listConfigDirectory();
        const parsed: unknown = JSON.parse(rerunStdout);

        expect(rerunModifiedTime).toBe(firstModifiedTime);
        expect(rerunEntries).toStrictEqual(firstEntries);
        expect(parsed).toHaveProperty('result.status', 'unchanged');
      },
      TIMEOUT_MS
    );
  });
});
