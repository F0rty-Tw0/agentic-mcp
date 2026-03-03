export type { ExecuteCommandOptions, ExecutionResult, StreamChunkCallback, StreamCollector } from './common';

export { MAX_ERROR_STDERR_BYTES } from './common';

export { CommandExecutionError } from './common/errors';

export type { CommandExecutionErrorDetails } from './common/errors/command-execution.error';

export {
  TEST_EXECUTE_COMMAND_OPTIONS_STUB,
  SUCCESS_EXECUTION_RESULT_STUB,
  TEST_MINIMAL_ENV_STUB,
} from './common/stubs';

export { createControllableChild } from './common/test-utils';

export type { ControllableChild } from './common/test-utils';

export type { AsyncViFn, SyncViFn } from './common/test-utils';

export { executeCommand } from './domain-logic/command-executor';

export { createSemaphore } from './domain-logic/semaphore';

export { attachStreamCollector } from './domain-logic/command-stream-collector.util';

export { buildMinimalEnv, killProcess, resolveCliBinary, stripAnsi } from './utils';
