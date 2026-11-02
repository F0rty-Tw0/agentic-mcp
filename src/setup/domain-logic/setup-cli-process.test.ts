// Integration test: spawns the built binary (`pnpm run build` first) with a scratch HOME, so real files are written.

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const BINARY_PATH = 'dist/index.js';
const TIMEOUT_MS = 30_000;
const SETUP_ARGS = ['setup', '--client', 'claude-code', '--output', 'json', '--yes'];
const INVALID_JSON = '{ "mcpServers": ';

type FileIdentity = {
  readonly inode: number;
  readonly mtimeMs: number;
};

type SetupExit = {
  readonly exitCode: number;
  readonly stdout: string;
};

let homeDirectory: string;

const buildSetupEnv = (): NodeJS.ProcessEnv => {
  const inheritedEntries = Object.entries(process.env).filter(([key]) => key !== 'CLAUDE_CONFIG_DIR');
  const env = Object.fromEntries([...inheritedEntries, ['HOME', homeDirectory]]);

  return env;
};

const runSetupProcess = async (): Promise<string> => {
  const { stdout } = await execFileAsync(process.execPath, [BINARY_PATH, ...SETUP_ARGS], { env: buildSetupEnv() });

  return stdout;
};

const runSetupExpectingFailure = async (): Promise<SetupExit> => {
  const result = await new Promise<SetupExit>((resolve) => {
    execFile(process.execPath, [BINARY_PATH, ...SETUP_ARGS], { env: buildSetupEnv() }, (error, stdout) => {
      resolve({ exitCode: Number(error?.code ?? 0), stdout });
    });
  });

  return result;
};

const readIdentity = async (targetPath: string): Promise<FileIdentity> => {
  const details = await stat(targetPath);
  const identity: FileIdentity = { inode: details.ino, mtimeMs: details.mtimeMs };

  return identity;
};

const listBackups = async (): Promise<string[]> => {
  const entries = await readdir(homeDirectory);
  const backups = entries.filter((entry) => entry.endsWith('.bak'));

  return backups;
};

beforeEach(async () => {
  homeDirectory = await mkdtemp(path.join(os.tmpdir(), 'setup-process-'));
});

afterEach(async () => {
  await rm(homeDirectory, { recursive: true, force: true });
});

describe.skipIf(!existsSync(BINARY_PATH))('integration: setup binary with a scratch HOME', () => {
  it(
    'GIVEN --output json for claude-code WHEN setup runs THEN stdout is one JSON document with the skill result',
    async () => {
      const stdout = await runSetupProcess();
      const parsed: unknown = JSON.parse(stdout);
      const skillPath = path.join(homeDirectory, '.claude', 'skills', 'using-agentic-mcp', 'SKILL.md');
      const skillResult = { status: 'installed', skillPath };

      expect(parsed).toHaveProperty('skillResult', skillResult);
    },
    TIMEOUT_MS
  );

  it(
    'GIVEN a configured claude-code entry WHEN setup runs again THEN the file is not rewritten and no backup is made',
    async () => {
      const configPath = path.join(homeDirectory, '.claude.json');

      await runSetupProcess();

      const before = await readIdentity(configPath);
      const stdout = await runSetupProcess();
      const after = await readIdentity(configPath);
      const backups = await listBackups();
      const parsed: unknown = JSON.parse(stdout);

      expect(after).toStrictEqual(before);
      expect(backups).toStrictEqual([]);
      expect(parsed).toHaveProperty('result.status', 'unchanged');
    },
    TIMEOUT_MS
  );

  it(
    'GIVEN invalid JSON in the claude-code config WHEN setup runs THEN it exits 1 with a manual result and leaves the file as it was',
    async () => {
      const configPath = path.join(homeDirectory, '.claude.json');

      await writeFile(configPath, INVALID_JSON);

      const { exitCode, stdout } = await runSetupExpectingFailure();
      const parsed: unknown = JSON.parse(stdout);
      const content = await readFile(configPath, 'utf8');

      expect(exitCode).toBe(1);
      expect(parsed).toHaveProperty('result', { status: 'manual', path: configPath });
      expect(content).toBe(INVALID_JSON);
    },
    TIMEOUT_MS
  );
});
