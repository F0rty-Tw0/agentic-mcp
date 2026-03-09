import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult, Progress } from '@modelcontextprotocol/sdk/types.js';

import type { AskToolArgs } from '../../ask';
import type { AskAllToolArgs } from '../../ask-all';
import { createServer } from '../../server';
import { APP_VERSION } from '../../shared';

export type CallCliToolInput = Readonly<{
  toolName: string;
  args: AskToolArgs | AskAllToolArgs;
  configPath?: string;
  onProgress?: (progress: Progress) => void;
}>;

const buildRequestOptions = (
  onProgress: CallCliToolInput['onProgress']
): Readonly<{ onprogress: CallCliToolInput['onProgress']; resetTimeoutOnProgress: true }> => {
  const result: Readonly<{
    onprogress: CallCliToolInput['onProgress'];
    resetTimeoutOnProgress: true;
  }> = {
    onprogress: onProgress,
    resetTimeoutOnProgress: true,
  };

  return result;
};

const resolveProviderNames = (toolName: string): readonly string[] | undefined => {
  const match = /^(?:ask|ping|help|sessions)_(.+)$/.exec(toolName);

  if (!match) return;

  if (toolName === 'ask_all') return;

  return [match[1] as string];
};

const shouldWarnDangerousFlags = (toolName: string): boolean => {
  const result = toolName === 'ask_all' || toolName.startsWith('ask_');

  return result;
};

export const callCliTool = async (input: CallCliToolInput): Promise<CallToolResult> => {
  const { args, configPath, onProgress, toolName } = input;
  const providerNames = resolveProviderNames(toolName);
  const warnDangerousFlags = shouldWarnDangerousFlags(toolName);
  const server = await createServer({ configPath, providerNames, warnDangerousFlags });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'agentic-mcp-cli', version: APP_VERSION });

  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const requestOptions = buildRequestOptions(onProgress);
    const result = await client.callTool({ name: toolName, arguments: args }, undefined, requestOptions);

    return result as CallToolResult;
  } finally {
    await client.close();
    await server.close();
  }
};
