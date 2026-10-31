import { afterEach, describe, expect, it } from 'vitest';

import { executeCommand } from './command-executor';
import type { ExecuteCommandOptions, ExecutionResult, ExecutionTimeoutCause } from '../common';

const LARGE_STDIN_BYTES = 4 * 1024 * 1024;

const GRANDCHILD_HOLDING_STDIO_LINES = [
  "const { spawn } = require('node:child_process');",
  "spawn(process.execPath, ['-e', 'setTimeout(() => undefined, 20_000)'], { stdio: 'inherit' });",
  'setTimeout(() => undefined, 20_000);',
];
const GRANDCHILD_HOLDING_STDIO_SCRIPT = GRANDCHILD_HOLDING_STDIO_LINES.join('\n');

const ESCAPED_GRANDCHILD_LINES = [
  "const { spawn } = require('node:child_process');",
  "const grandchild = spawn(process.execPath, ['-e', 'setTimeout(() => undefined, 20_000)'], {",
  "  stdio: 'inherit',",
  '  detached: true,',
  '});',
  'process.stdout.write(String(grandchild.pid));',
  'setTimeout(() => undefined, 20_000);',
];
const ESCAPED_GRANDCHILD_SCRIPT = ESCAPED_GRANDCHILD_LINES.join('\n');

const RESULT_WITH_ESCAPED_GRANDCHILD_LINES = [
  "const { spawn } = require('node:child_process');",
  "const grandchild = spawn(process.execPath, ['-e', 'setTimeout(() => undefined, 20_000)'], {",
  "  stdio: 'inherit',",
  '  detached: true,',
  '});',
  'process.stdout.write(`RESULT ${grandchild.pid}\\n`);',
  'setTimeout(() => undefined, 60_000);',
];
const RESULT_WITH_ESCAPED_GRANDCHILD_SCRIPT = RESULT_WITH_ESCAPED_GRANDCHILD_LINES.join('\n');

const EXITED_WITH_GRANDCHILD_HOLDING_STDOUT_LINES = [
  "const { spawn } = require('node:child_process');",
  "spawn(process.execPath, ['-e', 'setTimeout(() => undefined, 20_000)'], { stdio: 'inherit' });",
  "process.stdout.write('RESULT\\n');",
  'process.exit(0);',
];
const EXITED_WITH_GRANDCHILD_HOLDING_STDOUT_SCRIPT = EXITED_WITH_GRANDCHILD_HOLDING_STDOUT_LINES.join('\n');

const EXITED_WITH_ESCAPED_GRANDCHILD_LINES = [
  "const { spawn } = require('node:child_process');",
  "const grandchild = spawn(process.execPath, ['-e', 'setTimeout(() => undefined, 20_000)'], {",
  "  stdio: 'inherit',",
  '  detached: true,',
  '});',
  'process.stdout.write(`RESULT ${grandchild.pid}\\n`);',
  'process.exit(0);',
];
const EXITED_WITH_ESCAPED_GRANDCHILD_SCRIPT = EXITED_WITH_ESCAPED_GRANDCHILD_LINES.join('\n');

const SETTLE_BEFORE_GRANDCHILD_EXIT_MS = 10_000;

const ABORT_AFTER_EXIT_MS = 500;

const escapedPids: number[] = [];

const killQuietly = (pid: number): void => {
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // Already exited
  }
};

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

const runWithEscapedGrandchild = async (overrides: Partial<ExecuteCommandOptions>): Promise<ExecutionResult> => {
  const options = buildNodeOptions(EXITED_WITH_ESCAPED_GRANDCHILD_SCRIPT, overrides);
  const result = await executeCommand(options);
  const grandchildPid = Number(result.stdout.replace('RESULT', ''));

  escapedPids.push(grandchildPid);

  return result;
};

describe('FEATURE: executeCommand with real child processes', () => {
  afterEach(() => {
    escapedPids.splice(0).forEach(killQuietly);
  });

  describe('GIVEN a child that exits without reading its stdin', () => {
    it('WHEN a large stdin payload is written THEN the broken pipe is absorbed and the exit code is returned', async () => {
      const options = buildNodeOptions('process.exit(0)', { stdin: 'x'.repeat(LARGE_STDIN_BYTES) });

      const result = await executeCommand(options);

      expect(result.exitCode).toBe(0);
    });
  });

  describe('GIVEN a child that writes once and then goes silent', () => {
    it('WHEN idleTimeoutMs elapses THEN the child is killed and the result reports a timeout', async () => {
      const options = buildNodeOptions("process.stdout.write('x'); setTimeout(() => undefined, 20_000)", {
        idleTimeoutMs: 300,
      });

      const result = await executeCommand(options);

      expect(result.timedOut).toBe(true);
    });

    it('WHEN idleTimeoutMs elapses THEN the result names the idle limit as the cause', async () => {
      const options = buildNodeOptions("process.stdout.write('x'); setTimeout(() => undefined, 20_000)", {
        idleTimeoutMs: 300,
      });

      const result = await executeCommand(options);
      const expectedCause: ExecutionTimeoutCause = { kind: 'idle', limitMs: 300 };

      expect(result.timeoutCause).toStrictEqual(expectedCause);
    });
  });

  describe('GIVEN a child that prints a complete result and then never exits', () => {
    const script = "process.stdout.write('RESULT\\n'); setTimeout(() => undefined, 60_000)";
    const isResultComplete = (chunk: string): boolean => chunk.includes('RESULT');

    it('WHEN a result detector is set THEN the child is stopped well before the timeout', async () => {
      const options = buildNodeOptions(script, { timeoutMs: 30_000, isResultComplete, resultExitGraceMs: 500 });

      const result = await executeCommand(options);

      expect(result.executionTimeMs).toBeLessThan(15_000);
    }, 20_000);

    it('WHEN a result detector is set THEN the result reports the stop as a timeout', async () => {
      const options = buildNodeOptions(script, { timeoutMs: 30_000, isResultComplete, resultExitGraceMs: 500 });

      const result = await executeCommand(options);

      expect(result.timedOut).toBe(true);
    }, 20_000);
  });

  describe('GIVEN a child that prints a complete result while a grandchild outside its group holds stdout', () => {
    it('WHEN the result watch stops the child THEN the result settles before the grandchild exits', async () => {
      const isResultComplete = (chunk: string): boolean => chunk.includes('RESULT');
      const options = buildNodeOptions(RESULT_WITH_ESCAPED_GRANDCHILD_SCRIPT, {
        timeoutMs: 30_000,
        isResultComplete,
        resultExitGraceMs: 300,
      });

      const result = await executeCommand(options);
      const grandchildPid = Number(result.stdout.replace('RESULT', ''));

      escapedPids.push(grandchildPid);

      expect(result.executionTimeMs).toBeLessThan(10_000);
    }, 40_000);
  });

  describe('GIVEN a child that prints a complete result and exits while its grandchild holds stdout', () => {
    it('WHEN the result watch stops the grandchild THEN the cause says the output was held after the exit', async () => {
      const isResultComplete = (chunk: string): boolean => chunk.includes('RESULT');
      const options = buildNodeOptions(EXITED_WITH_GRANDCHILD_HOLDING_STDOUT_SCRIPT, {
        timeoutMs: 30_000,
        isResultComplete,
        resultExitGraceMs: 300,
      });

      const result = await executeCommand(options);

      expect(result.timeoutCause?.outputHeldAfterExit).toBe(true);
    }, 40_000);
  });

  describe('GIVEN a child that prints a result and exits while a grandchild outside its group holds stdout', () => {
    it('WHEN the result watch stops it THEN the result settles before the grandchild exits', async () => {
      const isResultComplete = (chunk: string): boolean => chunk.includes('RESULT');

      const result = await runWithEscapedGrandchild({ timeoutMs: 30_000, isResultComplete, resultExitGraceMs: 300 });

      expect(result.executionTimeMs).toBeLessThan(SETTLE_BEFORE_GRANDCHILD_EXIT_MS);
    }, 40_000);

    it('WHEN timeoutMs elapses THEN the result settles before the grandchild exits', async () => {
      const result = await runWithEscapedGrandchild({ timeoutMs: 500 });

      expect(result.executionTimeMs).toBeLessThan(SETTLE_BEFORE_GRANDCHILD_EXIT_MS);
    }, 40_000);

    it('WHEN idleTimeoutMs elapses THEN the result settles before the grandchild exits', async () => {
      const result = await runWithEscapedGrandchild({ timeoutMs: 30_000, idleTimeoutMs: 300 });

      expect(result.executionTimeMs).toBeLessThan(SETTLE_BEFORE_GRANDCHILD_EXIT_MS);
    }, 40_000);

    it('WHEN the call is aborted THEN the result settles before the grandchild exits', async () => {
      const signal = AbortSignal.timeout(ABORT_AFTER_EXIT_MS);

      const result = await runWithEscapedGrandchild({ timeoutMs: 30_000, signal });

      expect(result.executionTimeMs).toBeLessThan(SETTLE_BEFORE_GRANDCHILD_EXIT_MS);
    }, 40_000);
  });

  describe('GIVEN a child whose grandchild inherits its stdio', () => {
    it('WHEN timeoutMs elapses THEN the whole tree is killed and the result settles as timed out', async () => {
      const options = buildNodeOptions(GRANDCHILD_HOLDING_STDIO_SCRIPT, { timeoutMs: 500 });

      const result = await executeCommand(options);

      expect(result.timedOut).toBe(true);
    });
  });

  describe('GIVEN a grandchild that left the process group but still holds stdio', () => {
    it('WHEN timeoutMs elapses THEN the result settles once the child has exited', async () => {
      const options = buildNodeOptions(ESCAPED_GRANDCHILD_SCRIPT, { timeoutMs: 500 });

      const result = await executeCommand(options);

      escapedPids.push(Number(result.stdout));

      expect(result.timedOut).toBe(true);
    });
  });
});
