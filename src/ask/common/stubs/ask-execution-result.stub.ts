import type { ExecutionResult } from '../../../shared/common/index.ts';

export const ASK_SUCCESS_EXECUTION_RESULT_STUB: ExecutionResult = {
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

export const ASK_COMMAND_OUTPUT_EXECUTION_RESULT_STUB: ExecutionResult = {
  ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
  stdout: 'command output',
  stdoutBytes: 14,
};
