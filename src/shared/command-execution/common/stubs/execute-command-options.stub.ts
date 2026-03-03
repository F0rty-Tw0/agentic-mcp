import type { ExecuteCommandOptions } from '../command-executor.types';
import { TEST_MINIMAL_ENV_STUB } from './env.stub';

export const TEST_EXECUTE_COMMAND_OPTIONS_STUB: Pick<
  ExecuteCommandOptions,
  'binaryPath' | 'args' | 'env' | 'timeoutMs'
> = {
  binaryPath: '/usr/bin/test-cli',
  args: ['run'],
  env: TEST_MINIMAL_ENV_STUB,
  timeoutMs: 5_000,
};
