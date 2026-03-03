import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { handleAsk } from '../../ask';
import type { AskToolArgs } from '../../ask';
import type { ResolvedProviderEntry } from '../../shared/common';
import type { AskAllProviderResult, AskAllResult, AskAllToolArgs } from '../common';
import { extractResponseText } from '../utils';

const runProviderAsk = async (provider: ResolvedProviderEntry, args: AskAllToolArgs): Promise<AskAllProviderResult> => {
  const startTime = Date.now();

  const askArgs: AskToolArgs = {
    prompt: args.prompt,
    model: args.model,
    context: args.context,
    working_directory: args.working_directory,
    system_prompt: args.system_prompt,
  };

  try {
    const result = await handleAsk(provider, askArgs);
    const executionTimeMs = Date.now() - startTime;
    const text = extractResponseText(result);

    if (result.isError) {
      const askAllResult: AskAllProviderResult = {
        provider: provider.name,
        success: false,
        executionTimeMs,
        error: text,
      };

      return askAllResult;
    }

    const askAllResult: AskAllProviderResult = {
      provider: provider.name,
      success: true,
      executionTimeMs,
      response: text,
    };

    return askAllResult;
  } catch (err: unknown) {
    const executionTimeMs = Date.now() - startTime;
    const error = err instanceof Error ? err.message : String(err);

    const askAllResult: AskAllProviderResult = {
      provider: provider.name,
      success: false,
      executionTimeMs,
      error,
    };

    return askAllResult;
  }
};

export const handleAskAll = async (
  resolvedProviders: readonly ResolvedProviderEntry[],
  args: AskAllToolArgs
): Promise<CallToolResult> => {
  const filtered = args.providers?.length
    ? resolvedProviders.filter((provider) => args.providers?.includes(provider.name) ?? false)
    : resolvedProviders;

  if (!filtered.length) {
    const callToolResult: CallToolResult = {
      isError: true,
      content: [
        { type: 'text', text: 'No matching providers found. Check the providers filter or configure providers.' },
      ],
    };

    return callToolResult;
  }

  const wallStart = Date.now();
  const results = await Promise.all(
    filtered.map(async (provider): Promise<AskAllProviderResult> => runProviderAsk(provider, args))
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

  const text = JSON.stringify(askAllResult, null, 2);
  const callToolResult: CallToolResult = {
    isError: succeeded.length === 0,
    content: [{ type: 'text', text }],
  };

  return callToolResult;
};
