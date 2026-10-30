import type { ExecutionResult } from '../../../shared/command-execution/common';
import type { ProviderConfig, ResolvedProviderEntry } from '../../../shared/provider/common';

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

const ask = { args: ['exec'], flags: {} };
const commands = { ask };
const input: ProviderConfig['input'] = { method: 'positional' };

export const SIMPLE_TOOLS_PROVIDER_CONFIG_STUB: ProviderConfig = {
  enabled: true,
  description: 'Test provider',
  command: 'test-cli',
  timeout: 120_000,
  env: {},
  outputFormat: 'json',
  commands,
  input,
};

export const SIMPLE_TOOLS_RESOLVED_PROVIDER_ENTRY_STUB: ResolvedProviderEntry = {
  name: 'test',
  binaryPath: '/usr/bin/test-cli',
  config: SIMPLE_TOOLS_PROVIDER_CONFIG_STUB,
};
