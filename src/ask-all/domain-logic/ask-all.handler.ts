import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { buildAskAllSummary } from './ask-all-summary.builder';
import { handleAsk } from '../../ask';
import type { AskToolArgs } from '../../ask';
import { resolveAskTimeoutMs } from '../../ask/utils';
import type { ProgressContext, ResolvedProviderEntry } from '../../shared';
import type { AskAllProviderResult, AskAllResult, AskAllToolArgs } from '../common';
import { extractResponseText } from '../utils';

type RunProviderAskInput = Readonly<{
  provider: ResolvedProviderEntry;
  args: AskAllToolArgs;
  model?: string;
}>;

type ResolvedAskAllInput = Readonly<{
  filteredProviders: readonly ResolvedProviderEntry[];
  model?: string;
}>;

const buildErrorResult = (text: string): CallToolResult => ({
  isError: true,
  content: [{ type: 'text', text }],
});

const buildAskArgs = (args: AskAllToolArgs, model?: string): AskToolArgs => ({
  prompt: args.prompt,
  ...(model ? { model } : {}),
  context: args.context,
  working_directory: args.working_directory,
  system_prompt: args.system_prompt,
});

const buildProviderFailure = (
  provider: ResolvedProviderEntry,
  executionTimeMs: number,
  error: string
): AskAllProviderResult => ({
  provider: provider.name,
  success: false,
  executionTimeMs,
  error,
});

const buildProviderSuccess = (
  provider: ResolvedProviderEntry,
  executionTimeMs: number,
  response: string
): AskAllProviderResult => ({
  provider: provider.name,
  success: true,
  executionTimeMs,
  response,
});

const buildProviderTimeoutMessage = (providerName: string, timeoutMs: number): string =>
  `ask_all provider "${providerName}" timed out after ${timeoutMs}ms`;

const createAskAllProgressContext = (signal: AbortSignal): ProgressContext => ({
  sendNotification: async (): Promise<void> => {
    await Promise.resolve();
  },
  ['_meta']: {},
  signal,
});

const runAskWithTimeout = async (provider: ResolvedProviderEntry, askArgs: AskToolArgs): Promise<CallToolResult> => {
  const controller = new AbortController();
  const progressContext = createAskAllProgressContext(controller.signal);
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

const resolveAskAllInput = (
  resolvedProviders: readonly ResolvedProviderEntry[],
  args: AskAllToolArgs
): ResolvedAskAllInput => {
  if (args.providers?.length) {
    const requestedProviders = resolvedProviders.filter((provider) => args.providers?.includes(provider.name) ?? false);
    const result: ResolvedAskAllInput = {
      filteredProviders: requestedProviders,
      model: args.model,
    };

    return result;
  }

  const result: ResolvedAskAllInput = {
    filteredProviders: resolvedProviders,
    model: args.model,
  };

  return result;
};

const runProviderAsk = async (runProviderAskInput: RunProviderAskInput): Promise<AskAllProviderResult> => {
  const { provider, args, model } = runProviderAskInput;
  const startTime = Date.now();

  try {
    const result = await runAskWithTimeout(provider, buildAskArgs(args, model));
    const text = extractResponseText(result);
    const executionTimeMs = Date.now() - startTime;

    if (!result.isError) {
      return buildProviderSuccess(provider, executionTimeMs, text);
    }

    return buildProviderFailure(provider, executionTimeMs, text);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);

    return buildProviderFailure(provider, Date.now() - startTime, error);
  }
};

export const handleAskAll = async (
  resolvedProviders: readonly ResolvedProviderEntry[],
  args: AskAllToolArgs
): Promise<CallToolResult> => {
  const resolvedInput = resolveAskAllInput(resolvedProviders, args);

  if (!resolvedInput.filteredProviders.length) {
    return buildErrorResult('No matching providers found. Check the providers filter or configure providers.');
  }

  const wallStart = Date.now();
  const results = await Promise.all(
    resolvedInput.filteredProviders.map(
      async (provider): Promise<AskAllProviderResult> => runProviderAsk({ provider, args, model: resolvedInput.model })
    )
  );
  const totalExecutionTimeMs = Date.now() - wallStart;

  const succeeded = results.filter((result) => result.success);
  const failed = results.length - succeeded.length;

  const askAllResult: AskAllResult = {
    prompt: args.prompt,
    totalProviders: results.length,
    succeeded: succeeded.length,
    failed,
    totalExecutionTimeMs,
    results,
  };

  const summaryText = buildAskAllSummary(askAllResult);
  const callToolResult: CallToolResult = {
    isError: succeeded.length === 0,
    content: [{ type: 'text', text: summaryText }],
    structuredContent: askAllResult,
  };

  return callToolResult;
};
