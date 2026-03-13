/**
 * Integration test — exercises the setup CLI with real filesystem operations.
 * Uses runSetup with injected dependencies for controlled test environment.
 * No mocks on filesystem — real writes, reads, backups.
 *
 * Uses `.test` extension to distinguish from unit `.spec` files.
 * Run with: pnpm run test:integration
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DetectedProvider } from '../common';
import { runSetup } from './setup-cli';

let tempDir: string;
let stdoutOutput: string;
let stderrOutput: string;

const stubProviders: readonly DetectedProvider[] = [{ name: 'claude', available: true, binaryPath: '/usr/bin/claude' }];

const commonDeps = (): {
  detectInstalledProviders: () => Promise<readonly DetectedProvider[]>;
  stdoutWrite: (text: string) => void;
  stderrWrite: (text: string) => void;
  homeDirectory: string;
  isInteractive: boolean;
} => ({
  detectInstalledProviders: async (): Promise<readonly DetectedProvider[]> => {
    const result = await Promise.resolve(stubProviders);

    return result;
  },
  stdoutWrite: (text: string): void => {
    stdoutOutput += text;
  },
  stderrWrite: (text: string): void => {
    stderrOutput += text;
  },
  homeDirectory: tempDir,
  isInteractive: false,
});

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'setup-test-'));
  stdoutOutput = '';
  stderrOutput = '';
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('integration: setup fresh write', () => {
  it('GIVEN --yes and --path WHEN runSetup runs THEN it writes config and points to the first real-use command', async () => {
    const targetPath = path.join(tempDir, 'config.json');

    await runSetup(['--client', 'generic', '--yes', '--path', targetPath], commonDeps());

    const content = await readFile(targetPath, 'utf8');
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const mcpServers = parsed.mcpServers as Record<string, unknown>;

    expect(mcpServers).toBeDefined();
    expect(mcpServers['agentic-mcp']).toBeDefined();
    expect(stdoutOutput).toContain('Next command to prove real use:');
    expect(stdoutOutput).toContain('npx agentic-mcp prove claude');
  });
});

describe('integration: setup merge with existing config', () => {
  it('GIVEN an existing config with other servers WHEN runSetup runs THEN both entries are preserved', async () => {
    const targetPath = path.join(tempDir, 'existing.json');
    const existingConfig = JSON.stringify({ mcpServers: { 'other-server': { command: 'other' } } }, null, 2);

    await writeFile(targetPath, existingConfig, 'utf8');

    await runSetup(['--client', 'generic', '--yes', '--path', targetPath], commonDeps());

    const content = await readFile(targetPath, 'utf8');
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const mcpServers = parsed.mcpServers as Record<string, unknown>;

    expect(mcpServers['other-server']).toBeDefined();
    expect(mcpServers['agentic-mcp']).toBeDefined();
  });
});

describe('integration: setup backup creation', () => {
  it('GIVEN an existing config WHEN runSetup runs with backup THEN a .bak file is created', async () => {
    const targetPath = path.join(tempDir, 'backup-test.json');
    const originalContent = JSON.stringify({ mcpServers: { original: {} } }, null, 2);

    await writeFile(targetPath, originalContent, 'utf8');

    await runSetup(['--client', 'generic', '--yes', '--path', targetPath, '--backup'], commonDeps());

    const backupContent = await readFile(`${targetPath}.bak`, 'utf8');

    expect(backupContent).toBe(originalContent);
  });
});

describe('integration: non-interactive safety gate', () => {
  it('GIVEN non-interactive mode without --yes WHEN runSetup runs THEN it aborts with error message', async () => {
    const targetPath = path.join(tempDir, 'blocked.json');

    await runSetup(['--client', 'generic', '--path', targetPath], commonDeps());

    expect(stderrOutput).toContain('non-interactive write requires explicit --yes');

    let fileExists = true;

    try {
      await readFile(targetPath);
    } catch {
      fileExists = false;
    }

    expect(fileExists).toBe(false);
  });
});

describe('integration: minimal setup', () => {
  it('GIVEN --minimal WHEN runSetup runs THEN it installs the skill and surfaces the first real-proof command after setup', async () => {
    await runSetup(['--minimal'], commonDeps());

    const skillPath = path.join(tempDir, '.claude', 'skills', 'using-agentic-mcp', 'SKILL.md');
    const skillContent = await readFile(skillPath, 'utf8');

    expect(skillContent).toContain('name: using-agentic-mcp');
    expect(stdoutOutput).toContain('agentic-mcp init');
    expect(stdoutOutput).toContain('What remains unproven:');
    expect(stdoutOutput).toContain('npx agentic-mcp setup --client claude-code --yes');
    expect(stdoutOutput).toContain('First real-proof command after setup:');
    expect(stdoutOutput).toContain('npx agentic-mcp prove claude');
  });
});

describe('integration: dry run', () => {
  it('GIVEN --dry-run WHEN runSetup runs THEN no file is written but output is produced', async () => {
    const targetPath = path.join(tempDir, 'dry-run.json');

    await runSetup(['--client', 'generic', '--yes', '--path', targetPath, '--dry-run'], commonDeps());

    expect(stdoutOutput.length).toBeGreaterThan(0);

    let fileExists = true;

    try {
      await readFile(targetPath);
    } catch {
      fileExists = false;
    }

    expect(fileExists).toBe(false);
  });
});
