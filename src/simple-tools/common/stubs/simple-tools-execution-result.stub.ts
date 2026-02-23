import type { ExecutionResult } from '../../../shared/common/index.ts';

export const SIMPLE_TOOLS_SUCCESS_EXECUTION_RESULT_STUB: ExecutionResult = {
  stdout: '',
  stderr: '',
  exitCode: 0,
  signal: null,
  timedOut: false,
  truncated: false,
  stdoutBytes: 0,
  stderrBytes: 0,
  executionTimeMs: 50,
};

export const SIMPLE_TOOLS_PING_VERSION_RESULT_STUB: ExecutionResult = {
  ...SIMPLE_TOOLS_SUCCESS_EXECUTION_RESULT_STUB,
  stdout: 'v1.0.0',
  stdoutBytes: 6,
};

export const SIMPLE_TOOLS_HELP_OUTPUT_RESULT_STUB: ExecutionResult = {
  ...SIMPLE_TOOLS_SUCCESS_EXECUTION_RESULT_STUB,
  stdout: 'Usage: test-cli [options]',
  stdoutBytes: 25,
};
