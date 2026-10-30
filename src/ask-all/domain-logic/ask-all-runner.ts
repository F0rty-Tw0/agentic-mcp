import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import {
  buildErrorResult,
  buildProviderFailure,
  buildProviderSuccess,
  buildProviderTimeoutMessage,
} from './ask-all-result.builder';
import { handleAsk } from '../../ask';
import type { AskToolArgs } from '../../ask/common';
import { resolveAskTimeoutMs } from '../../ask/utils';
import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { ResolvedProviderEntry } from '../../shared/provider/common';
import type { AskAllProviderResult, AskAllToolArgs } from '../common';
import { extractResponseText } from '../utils';

type RunProviderAskInput = {
  readonly provider: ResolvedProviderEntry;
  readonly args: AskAllToolArgs;
  readonly model?: string;
  readonly callerSignal?: AbortSignal;
};

const buildModelArgs = (model?: string): AskToolArgs => {
  const noModelArgs: AskToolArgs = {};

  if (!model) return noModelArgs;

  const result: AskToolArgs = { model };

  return result;
};

const buildAskArgs = (args: AskAllToolArgs, model?: string): AskToolArgs => {
  const modelArgs = buildModelArgs(model);
  const result: AskToolArgs = {
    prompt: args.prompt,
    ...modelArgs,
    context: args.context,
    working_directory: args.working_directory,
    system_prompt: args.system_prompt,
  };

  return result;
};

const createAskAllProgressContext = (signal: AbortSignal): ProgressContext => {
  const result: ProgressContext = {
    sendNotification: async (): Promise<void> => {
      await Promise.resolve();
    },
    ['_meta']: {},
    signal,
  };

  return result;
};

const linkCallerSignal = (controller: AbortController, callerSignal?: AbortSignal): AbortSignal => {
  if (!callerSignal) return controller.signal;

  const linkedSignal = AbortSignal.any([controller.signal, callerSignal]);

  return linkedSignal;
};

const runAskWithTimeout = async (
  provider: ResolvedProviderEntry,
  askArgs: AskToolArgs,
  callerSignal?: AbortSignal
): Promise<CallToolResult> => {
  const controller = new AbortController();
  const signal = linkCallerSignal(controller, callerSignal);
  const progressContext = createAskAllProgressContext(signal);
  const timeoutMs = resolveAskTimeoutMs(provider.config.timeout);
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<CallToolResult>((resolve) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      resolve(buildErrorResult(buildProviderTimeoutMessage(provider.name, timeoutMs)));
    }, timeoutMs);
  });

  try {
    const askPromise = handleAsk(provider, askArgs, progressContext);
    const result = await Promise.race([askPromise, timeoutPromise]);

    return result;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const runProviderAsk = async (runProviderAskInput: RunProviderAskInput): Promise<AskAllProviderResult> => {
  const { provider, args, model, callerSignal } = runProviderAskInput;
  const startTime = Date.now();

  try {
    const result = await runAskWithTimeout(provider, buildAskArgs(args, model), callerSignal);
    const text = extractResponseText(result);
    const executionTimeMs = Date.now() - startTime;

    if (!result.isError) return buildProviderSuccess(provider, executionTimeMs, text);

    return buildProviderFailure(provider, executionTimeMs, text);
  } catch (err: unknown) {
    const errorText = String(err);
    const error = err instanceof Error ? err.message : errorText;

    return buildProviderFailure(provider, Date.now() - startTime, error);
  }
};
