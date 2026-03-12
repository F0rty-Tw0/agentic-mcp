import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import {
  buildMinimalEnv,
  buildProviderQueueOptions,
  executeCommand,
  resolveProviderEnv,
  stripAnsi,
  toMcpError,
} from '../../shared';
import type { ExecutionResult, ResolvedProviderEntry } from '../../shared';

const PING_TIMEOUT_MS = 30_000;

type PingFailureResult = Pick<ExecutionResult, 'exitCode' | 'signal' | 'timedOut'>;

const createPingResponse = (text: string): CallToolResult => {
  const pingResponse: CallToolResult = {
    content: [
      {
        type: 'text',
        text,
      },
    ],
  };

  return pingResponse;
};

const createAskProofMessage = (providerName: string): string => {
  return `Run ask_${providerName} to prove authentication and a real response.`;
};

const createBinaryDetectedText = (context: ResolvedProviderEntry): string => {
  return `${context.name}: binary detected at ${context.binaryPath}. This only proves the CLI is installed. ${createAskProofMessage(context.name)}`;
};

const createVersionSucceededText = (context: ResolvedProviderEntry, version: string): string => {
  return `${context.name}: version check succeeded (version: ${version}). This does not prove authentication or a successful ask. ${createAskProofMessage(context.name)}`;
};

const createVersionFailedText = (context: ResolvedProviderEntry, result: PingFailureResult): string => {
  return `${context.name}: version check failed (exit ${result.exitCode}, signal: ${result.signal}, timedOut: ${String(result.timedOut)}). Fix the CLI, then rerun ping_${context.name} before ask_${context.name}.`;
};

const resolveVersion = (output: string, pattern?: string): string => {
  if (!pattern) return output;

  const match = new RegExp(pattern).exec(output);

  if (!match?.[1]) return output;

  return match[1];
};

export const handlePing = async (context: ResolvedProviderEntry): Promise<CallToolResult> => {
  try {
    if (!context.config.versionCheck) {
      return createPingResponse(createBinaryDetectedText(context));
    }

    const providerEnv = resolveProviderEnv(context);
    const env = buildMinimalEnv(providerEnv);
    const providerQueue = buildProviderQueueOptions(context);
    const result = await executeCommand({
      binaryPath: context.binaryPath,
      args: [context.config.versionCheck.flag],
      env,
      timeoutMs: PING_TIMEOUT_MS,
      providerQueue,
    });

    if (result.timedOut || result.signal !== null || result.exitCode !== 0) {
      return createPingResponse(createVersionFailedText(context, result));
    }

    const output = stripAnsi(result.stdout).trim();
    const version = resolveVersion(output, context.config.versionCheck.pattern);

    return createPingResponse(createVersionSucceededText(context, version));
  } catch (error: unknown) {
    return toMcpError(error);
  }
};
