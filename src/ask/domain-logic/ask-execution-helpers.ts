import { buildNativeSessionArgs } from './ask-handler.util.ts';
import type { ExecutionResult, ProgressContext, ResolvedProviderEntry } from '../../shared/common/index.ts';
import { registerActiveRequest } from '../../shared/domain-logic/request-registry.ts';

export const buildRequestId = (extra: ProgressContext | undefined): string | undefined => {
  return extra?.requestId !== undefined ? String(extra.requestId) : undefined;
};

export const buildCliArgs = (
  baseCliArgs: readonly string[],
  context: ResolvedProviderEntry,
  tier2SessionId: string | undefined
): string[] => {
  return [...baseCliArgs, ...(tier2SessionId ? buildNativeSessionArgs(context.config, tier2SessionId) : [])];
};

export const buildOnSpawned = (requestId: string | undefined): ((pid: number) => void) | undefined => {
  return requestId ? (pid: number): void => registerActiveRequest(requestId, pid) : undefined;
};

export const isExecutionFailure = (result: ExecutionResult): boolean => {
  return result.timedOut || result.signal !== null || result.exitCode !== 0;
};
