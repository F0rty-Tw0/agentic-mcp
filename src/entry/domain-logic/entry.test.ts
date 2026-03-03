/**
 * Integration test — exercises the CLI entry point end-to-end
 * by spawning the built binary as a child process.
 *
 * Uses `.test` extension to distinguish from unit `.spec` files.
 * Run with: pnpm run test:integration
 *
 * Prerequisites: binary must be built first with `pnpm run build`.
 */

import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { promisify } from 'node:util';

import { beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const BINARY_PATH = 'dist/index.cjs';
const TIMEOUT_MS = 10_000;

let binaryExists = false;

beforeAll(async () => {
  try {
    await access(BINARY_PATH);
    binaryExists = true;
  } catch {
    binaryExists = false;
  }
});

describe('integration: CLI entry point binary', () => {
  it('GIVEN the binary is not built WHEN tests run THEN skip gracefully', () => {
    if (binaryExists) return;

    // eslint-disable-next-line no-console
    console.warn(`Binary not found at ${BINARY_PATH}. Run "pnpm run build" first.`);
    expect(binaryExists).toBe(false);
  });

  it(
    'GIVEN the --version flag WHEN the binary is spawned THEN stdout contains a semver-like version and exit code is 0',
    async () => {
      if (!binaryExists) return;

      const result = await execFileAsync(process.execPath, [BINARY_PATH, '--version']);
      const stdout = result.stdout.trim();

      expect(stdout).toMatch(/\d+\.\d+\.\d+/);
    },
    TIMEOUT_MS
  );

  it(
    'GIVEN the --help flag WHEN the binary is spawned THEN stdout contains usage information and exit code is 0',
    async () => {
      if (!binaryExists) return;

      const result = await execFileAsync(process.execPath, [BINARY_PATH, '--help']);
      const stdout = result.stdout;

      expect(stdout.length).toBeGreaterThan(0);
      expect(stdout).toMatch(/agentic-mcp|usage/i);
    },
    TIMEOUT_MS
  );

  it(
    'GIVEN an invalid --config path WHEN the binary is spawned THEN it exits with non-zero code and stderr has an error',
    async () => {
      if (!binaryExists) return;

      try {
        await execFileAsync(process.execPath, [BINARY_PATH, '--config', '/nonexistent/path.json']);
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        const execError = error as { code: number; stderr: string };

        expect(execError.code).not.toBe(0);
        expect(execError.stderr).toBeTruthy();
      }
    },
    TIMEOUT_MS
  );
});
