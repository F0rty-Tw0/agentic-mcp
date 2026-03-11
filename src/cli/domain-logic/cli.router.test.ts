/**
 * Integration test — exercises the CLI router end-to-end
 * by spawning the built binary as a child process.
 *
 * Uses `.test` extension to distinguish from unit `.spec` files.
 * Run with: pnpm run test:integration
 *
 * Prerequisites: binary must be built first with `pnpm run build`.
 */

import { execFile } from 'node:child_process';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const BINARY_PATH = 'dist/index.js';
const TIMEOUT_MS = 10_000;
const ASK_TIMEOUT_MS = 30_000;

const KNOWN_PROVIDERS = ['claude', 'codex', 'copilot', 'gemini', 'opencode'];

let binaryExists = false;

beforeAll(async () => {
  try {
    await access(BINARY_PATH);
    binaryExists = true;
  } catch {
    binaryExists = false;
  }
});

const isSuccessfulPingText = (text: string): boolean => {
  return text.includes('binary detected') || text.includes('version check succeeded');
};

const isProviderAvailable = async (provider: string): Promise<boolean> => {
  const result = await execFileAsync(process.execPath, [BINARY_PATH, `ping_${provider}`]).catch(() => undefined);

  return !result ? false : isSuccessfulPingText(result.stdout);
};

const findAvailableProvider = async (): Promise<string | undefined> => {
  for (const provider of KNOWN_PROVIDERS) {
    if (await isProviderAvailable(provider)) return provider;
  }

  return undefined;
};

const STREAMED_STDERR_MARKER = 'STREAMED-STDERR-MARKER';
const FINAL_STDOUT_MARKER = 'FINAL-STDOUT-MARKER';

const createStreamingFixture = async (): Promise<Readonly<{ configPath: string; tempDir: string }>> => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cli-stream-fixture-'));
  const scriptPath = path.join(tempDir, 'stream-provider.js');
  const configPath = path.join(tempDir, 'providers.json');
  const script = [
    `process.stderr.write('${STREAMED_STDERR_MARKER}');`,
    `process.stdout.write('${FINAL_STDOUT_MARKER}');`,
  ].join('\n');
  const config = {
    configVersion: 1,
    providers: {
      fixture: {
        enabled: true,
        description: 'Streaming fixture provider',
        command: process.execPath,
        timeout: 10_000,
        env: {},
        outputFormat: 'text',
        commands: {
          ask: {
            args: [scriptPath],
          },
        },
        input: {
          method: 'positional',
        },
      },
    },
  };

  await writeFile(scriptPath, script, 'utf8');
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

  const result = { configPath, tempDir };

  return result;
};

const removeTempDir = async (tempDir: string): Promise<void> => {
  await rm(tempDir, { recursive: true, force: true });
};

describe('integration: CLI router', () => {
  it('GIVEN the binary is not built WHEN tests run THEN skip gracefully', () => {
    if (binaryExists) return;

    console.warn(`Binary not found at ${BINARY_PATH}. Run "pnpm run build" first.`);
    expect(binaryExists).toBe(false);
  });

  describe('global commands', () => {
    it(
      'GIVEN the list_providers command WHEN the binary is spawned THEN stdout contains provider names and exit code is 0',
      async () => {
        if (!binaryExists) return;

        const result = await execFileAsync(process.execPath, [BINARY_PATH, 'list_providers']);
        const stdout = result.stdout;

        expect(stdout).toMatch(/claude|codex|copilot|gemini|opencode/);
      },
      TIMEOUT_MS
    );

    it(
      'GIVEN the provider_metrics command WHEN the binary is spawned THEN stdout contains metrics output and exit code is 0',
      async () => {
        if (!binaryExists) return;

        const result = await execFileAsync(process.execPath, [BINARY_PATH, 'provider_metrics']);
        const stdout = result.stdout;

        expect(stdout.length).toBeGreaterThan(0);
      },
      TIMEOUT_MS
    );
  });

  describe('provider commands', () => {
    it(
      'GIVEN an available provider WHEN calling ping via CLI THEN stdout contains limited-proof wording and exit code is 0',
      async () => {
        if (!binaryExists) return;

        const provider = await findAvailableProvider();

        if (!provider) return;

        const result = await execFileAsync(process.execPath, [BINARY_PATH, `ping_${provider}`]);
        const stdout = result.stdout;

        expect(stdout).toContain(provider);
        expect(isSuccessfulPingText(stdout)).toBe(true);
      },
      TIMEOUT_MS
    );

    it(
      'GIVEN an available provider WHEN calling help via CLI THEN stdout is non-empty and exit code is 0',
      async () => {
        if (!binaryExists) return;

        const provider = await findAvailableProvider();

        if (!provider) return;

        const result = await execFileAsync(process.execPath, [BINARY_PATH, `help_${provider}`]);
        const stdout = result.stdout;

        expect(stdout.length).toBeGreaterThan(0);
      },
      TIMEOUT_MS
    );

    it(
      'GIVEN a controlled provider WHEN calling ask via CLI THEN stdout contains the provider response and exit code is 0',
      async () => {
        if (!binaryExists) return;

        const { configPath, tempDir } = await createStreamingFixture();

        try {
          const result = await execFileAsync(process.execPath, [
            BINARY_PATH,
            'ask_fixture',
            'ignored prompt',
            '--config',
            configPath,
          ]);
          const stdout = result.stdout;

          expect(stdout).toContain(FINAL_STDOUT_MARKER);
        } finally {
          await removeTempDir(tempDir);
        }
      },
      ASK_TIMEOUT_MS
    );
  });

  it(
    'GIVEN a controlled streaming provider WHEN calling ask with --stream-live via CLI THEN streamed stderr is observable separately from the final result',
    async () => {
      if (!binaryExists) return;

      const { configPath, tempDir } = await createStreamingFixture();

      try {
        const result = await execFileAsync(process.execPath, [
          BINARY_PATH,
          'ask_fixture',
          'ignored prompt',
          '--stream-live',
          '--config',
          configPath,
        ]);

        expect(result.stderr).toContain(STREAMED_STDERR_MARKER);
        expect(result.stdout).toContain(FINAL_STDOUT_MARKER);
      } finally {
        await removeTempDir(tempDir);
      }
    },
    ASK_TIMEOUT_MS
  );

  describe('error handling', () => {
    it(
      'GIVEN a non-existent provider WHEN calling ask via CLI THEN it exits with non-zero code and stderr contains "not found"',
      async () => {
        if (!binaryExists) return;

        const error = (await execFileAsync(process.execPath, [BINARY_PATH, 'ask_nonexistent', 'test']).catch(
          (err: unknown) => err
        )) as { code: number; stderr: string };

        expect(error.code).not.toBe(0);
        expect(error.stderr).toContain('not found');
      },
      TIMEOUT_MS
    );

    it(
      'GIVEN an invalid --config path WHEN calling list_providers via CLI THEN it exits with non-zero code and stderr has an error',
      async () => {
        if (!binaryExists) return;

        const error = (await execFileAsync(process.execPath, [
          BINARY_PATH,
          'list_providers',
          '--config',
          '/nonexistent/path.json',
        ]).catch((err: unknown) => err)) as { code: number; stderr: string };

        expect(error.code).not.toBe(0);
        expect(error.stderr).toBeTruthy();
      },
      TIMEOUT_MS
    );
  });
});
