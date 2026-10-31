// Integration test: spawns the built binary (`pnpm run build` first) with a scratch HOME, so real files are written.

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const BINARY_PATH = 'dist/index.js';
const TIMEOUT_MS = 30_000;
const SETUP_ARGS = ['setup', '--client', 'claude-code', '--output', 'json', '--yes'];

let homeDirectory: string;

const runSetupProcess = async (): Promise<string> => {
  const inheritedEntries = Object.entries(process.env).filter(([key]) => key !== 'CLAUDE_CONFIG_DIR');
  const env = Object.fromEntries([...inheritedEntries, ['HOME', homeDirectory]]);
  const { stdout } = await execFileAsync(process.execPath, [BINARY_PATH, ...SETUP_ARGS], { env });

  return stdout;
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
});
