import { describe, expect, it } from 'vitest';

import { executeCommand } from './command-executor';
import type { ExecuteCommandOptions } from '../common';

const LARGE_STDIN_BYTES = 4 * 1024 * 1024;

const GRANDCHILD_HOLDING_STDIO_LINES = [
  "const { spawn } = require('node:child_process');",
  "spawn(process.execPath, ['-e', 'setTimeout(() => undefined, 20_000)'], { stdio: 'inherit' });",
  'setTimeout(() => undefined, 20_000);',
];
const GRANDCHILD_HOLDING_STDIO_SCRIPT = GRANDCHILD_HOLDING_STDIO_LINES.join('\n');

const buildNodeOptions = (script: string, overrides: Partial<ExecuteCommandOptions> = {}): ExecuteCommandOptions => {
  const env = { PATH: process.env.PATH ?? '' };
  const executeCommandOptions: ExecuteCommandOptions = {
    binaryPath: process.execPath,
    args: ['-e', script],
    env,
    timeoutMs: 10_000,
    bypassSemaphore: true,
    ...overrides,
  };

  return executeCommandOptions;
};

describe('FEATURE: executeCommand with real child processes', () => {
  describe('GIVEN a child that exits without reading its stdin', () => {
    it('WHEN a large stdin payload is written THEN the broken pipe is absorbed and the exit code is returned', async () => {
      const options = buildNodeOptions('process.exit(0)', { stdin: 'x'.repeat(LARGE_STDIN_BYTES) });

      const result = await executeCommand(options);

      expect(result.exitCode).toBe(0);
    });
  });

  describe('GIVEN a child that never writes any output', () => {
    it('WHEN idleTimeoutMs elapses THEN the child is killed and the result reports a timeout', async () => {
      const options = buildNodeOptions('setTimeout(() => undefined, 20_000)', { idleTimeoutMs: 300 });

      const result = await executeCommand(options);

      expect(result.timedOut).toBe(true);
    });
  });

  describe('GIVEN a child whose grandchild inherits its stdio', () => {
    it('WHEN timeoutMs elapses THEN the whole tree is killed and the result settles as timed out', async () => {
      const options = buildNodeOptions(GRANDCHILD_HOLDING_STDIO_SCRIPT, { timeoutMs: 500 });

      const result = await executeCommand(options);

      expect(result.timedOut).toBe(true);
    });
  });
});
