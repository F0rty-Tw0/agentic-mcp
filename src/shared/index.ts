export { APP_VERSION } from './app-version.const';

// command-execution
export type { ExecuteCommandOptions, ExecutionResult, StreamChunkCallback, StreamCollector } from './command-execution';

export { MAX_ERROR_STDERR_BYTES } from './command-execution';

export { CommandExecutionError } from './command-execution';

export type { CommandExecutionErrorDetails } from './command-execution';

export {
  TEST_EXECUTE_COMMAND_OPTIONS_STUB,
  SUCCESS_EXECUTION_RESULT_STUB,
  TEST_MINIMAL_ENV_STUB,
} from './command-execution';

export { createControllableChild } from './command-execution';

export type { ControllableChild, AsyncViFn, SyncViFn } from './command-execution';

export { executeCommand, createSemaphore, attachStreamCollector } from './command-execution';

export { buildMinimalEnv, killProcess, resolveCliBinary, stripAnsi } from './command-execution';

// provider
export type { ConfigPathOptions, CommandDef, FlagValue, ProviderConfig, ProvidersFile } from './provider';

export { providersFileSchema } from './provider';

export type { ProviderEnv, ResolvedProvider, ResolvedProviderEntry } from './provider';

export { DEFAULT_MCP_TOOL_TIMEOUT_MS } from './provider';

export { TEST_PROVIDER_CONFIG_STUB, TEST_RESOLVED_PROVIDER_ENTRY_STUB } from './provider';

export { resolveProviderEnv } from './provider';

export { buildModelHint, detectModelError, extractAttemptedModel, fetchAvailableModels } from './provider';

// mcp-protocol
export type {
  McpPlainTextContent,
  McpTextContent,
  McpErrorResponse,
  OutputFormat,
  ProgressContext,
  ProgressToken,
  ToolDefinition,
} from './mcp-protocol';

export { toMcpError, startHeartbeat } from './mcp-protocol';

// validation
export { ValidationError } from './validation';

export { MAX_PROMPT_BYTES, MAX_FILES } from './validation';

export { registerActiveRequest, unregisterActiveRequest, getActiveRequest } from './validation';

export { nowIso } from './validation';

export {
  MODEL_REGEX,
  SESSION_ID_REGEX,
  validateFiles,
  validateModel,
  validatePromptSize,
  validateSessionId,
  validateWorkingDirectory,
} from './validation';
