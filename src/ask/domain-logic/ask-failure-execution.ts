import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { buildCommandFailure } from './ask-handler.util.ts';
import type { AskExecution } from './ask-runner.ts';
import type { ExecutionResult, ResolvedProviderEntry } from '../../shared/common/index.ts';
import type { AskToolArgs } from '../common/index.ts';
import type { buildExecutionSummary, createStreamNotifier } from '../utils/ask-stream-notifier.util.ts';

type BuildFailureExecutionInput = Readonly<{
  context: ResolvedProviderEntry;
  args: AskToolArgs;
  env: Readonly<Record<string, string>>;
  result: ExecutionResult;
  streamNotifier: ReturnType<typeof createStreamNotifier>;
  summary: ReturnType<typeof buildExecutionSummary>;
  buildFailureExecution: (response: CallToolResult, wasCancelled: boolean) => AskExecution;
  signal: AbortSignal | undefined;
}>;

export const buildFailureExecutionResult = async ({
  context,
  args,
  env,
  result,
  streamNotifier,
  summary,
  buildFailureExecution,
  signal,
}: BuildFailureExecutionInput): Promise<AskExecution> => {
  const error = await buildCommandFailure(context, args, env, result);

  streamNotifier.emitError(error.message, summary);

  return buildFailureExecution(error.toMcpResponse(), signal?.aborted ?? false);
};
