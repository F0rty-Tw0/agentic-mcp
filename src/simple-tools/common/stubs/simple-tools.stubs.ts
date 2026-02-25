import type { ExecutionResult, ProviderConfig, ResolvedProviderEntry } from '../../../shared/common';

export const SIMPLE_TOOLS_TEST_ENV_STUB: Readonly<Record<string, string>> = { PATH: '/usr/bin' };

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

export const SIMPLE_TOOLS_PROVIDER_CONFIG_STUB: ProviderConfig = {
  enabled: true,
  description: 'Test provider',
  command: 'test-cli',
  timeout: 120_000,
  env: {},
  outputFormat: 'json',
  commands: { ask: { args: ['exec'], flags: {} } },
  input: { method: 'positional' },
};

export const SIMPLE_TOOLS_RESOLVED_PROVIDER_ENTRY_STUB: ResolvedProviderEntry = {
  name: 'test',
  binaryPath: '/usr/bin/test-cli',
  config: SIMPLE_TOOLS_PROVIDER_CONFIG_STUB,
};

export const createSimpleToolsContext = (overrides: Partial<ProviderConfig> = {}): ResolvedProviderEntry => {
  const config: ProviderConfig = {
    ...SIMPLE_TOOLS_PROVIDER_CONFIG_STUB,
    ...overrides,
  };

  const context: ResolvedProviderEntry = {
    ...SIMPLE_TOOLS_RESOLVED_PROVIDER_ENTRY_STUB,
    config,
  };

  return context;
};
