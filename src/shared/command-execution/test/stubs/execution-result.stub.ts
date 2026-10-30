import type { ExecutionResult } from '../../common/command-executor.type';

export const SUCCESS_EXECUTION_RESULT_STUB: ExecutionResult = {
  stdout: '',
  stderr: '',
  exitCode: 0,
  signal: null,
  timedOut: false,
  truncated: false,
  stdoutBytes: 0,
  stderrBytes: 0,
  executionTimeMs: 100,
};
