import type { CallToolResult, TextContent } from '@modelcontextprotocol/server';

import { buildErrorResult } from './ask-all-result.builder';
import { runProviderAsk } from './ask-all-runner';
import { buildAskAllSummary } from './ask-all-summary.builder';
import { startHeartbeat } from '../../shared';
import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { ResolvedProviderEntry } from '../../shared/provider/common';
import type { AskAllProviderResult, AskAllResult, AskAllToolArgs } from '../common';

type ResolvedAskAllInput = {
  readonly filteredProviders: ResolvedProviderEntry[];
  readonly model?: string;
};

const resolveAskAllInput = (resolvedProviders: ResolvedProviderEntry[], args: AskAllToolArgs): ResolvedAskAllInput => {
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

const runAllProviderAsks = async (
  resolvedInput: ResolvedAskAllInput,
  args: AskAllToolArgs,
  extra?: ProgressContext
): Promise<AskAllProviderResult[]> => {
  const callerSignal = extra?.signal;
  const stopHeartbeat = startHeartbeat(extra);
  const runForProvider = async (provider: ResolvedProviderEntry): Promise<AskAllProviderResult> =>
    runProviderAsk({ provider, args, model: resolvedInput.model, callerSignal });

  try {
    const results = await Promise.all(resolvedInput.filteredProviders.map(runForProvider));

    return results;
  } finally {
    stopHeartbeat();
  }
};

export const handleAskAll = async (
  resolvedProviders: ResolvedProviderEntry[],
  args: AskAllToolArgs,
  extra?: ProgressContext
): Promise<CallToolResult> => {
  const resolvedInput = resolveAskAllInput(resolvedProviders, args);

  if (!resolvedInput.filteredProviders.length) {
    return buildErrorResult('No matching providers found. Check the providers filter or configure providers.');
  }

  const wallStart = Date.now();
  const results = await runAllProviderAsks(resolvedInput, args, extra);
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
  const content: TextContent[] = [{ type: 'text', text: summaryText }];
  const callToolResult: CallToolResult = {
    isError: succeeded.length === 0,
    content,
    structuredContent: askAllResult,
  };

  return callToolResult;
};
