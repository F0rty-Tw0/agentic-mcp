import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { handleAsk } from '../../ask/domain-logic/ask.handler';
import type { ResolvedProviderEntry } from "../../shared/common";
import type { AskAllProviderResult, AskAllResult, AskAllToolArgs } from "../common";

const extractResponseText = (result: CallToolResult): string => {
  const first = result.content[0];

  return first?.type === 'text' ? first.text : '';
};

const runProviderAsk = async (provider: ResolvedProviderEntry, args: AskAllToolArgs): Promise<AskAllProviderResult> => {
  const startTime = Date.now();

  const askArgs = {
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
      return {
        provider: provider.name,
        success: false,
        executionTimeMs,
        error: text,
      };
    }

    return {
      provider: provider.name,
      success: true,
      executionTimeMs,
      response: text,
    };
  } catch (err: unknown) {
    const executionTimeMs = Date.now() - startTime;
    const error = err instanceof Error ? err.message : String(err);

    return {
      provider: provider.name,
      success: false,
      executionTimeMs,
      error,
    };
  }
};

export const handleAskAll = async (
  resolvedProviders: readonly ResolvedProviderEntry[],
  args: AskAllToolArgs
): Promise<CallToolResult> => {
  const filtered =
    args.providers && args.providers.length > 0
      ? resolvedProviders.filter((p) => args.providers?.includes(p.name) ?? false)
      : resolvedProviders;

  if (filtered.length === 0) {
    return {
      isError: true,
      content: [
        { type: 'text', text: 'No matching providers found. Check the providers filter or configure providers.' },
      ],
    };
  }

  const wallStart = Date.now();
  const results = await Promise.all(filtered.map(async (p): Promise<AskAllProviderResult> => runProviderAsk(p, args)));
  const totalExecutionTimeMs = Date.now() - wallStart;

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.length - succeeded;

  const askAllResult: AskAllResult = {
    prompt: args.prompt,
    totalProviders: results.length,
    succeeded,
    failed,
    totalExecutionTimeMs,
    results,
  };

  return {
    isError: succeeded === 0,
    content: [{ type: 'text', text: JSON.stringify(askAllResult, null, 2) }],
  };
};
