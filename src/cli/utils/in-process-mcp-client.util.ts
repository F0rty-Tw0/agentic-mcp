import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult, Progress } from '@modelcontextprotocol/sdk/types.js';

import type { AskToolArgs } from '../../ask';
import type { AskAllToolArgs } from '../../ask-all';
import { createServer } from '../../server';
import { APP_VERSION, ValidationError } from '../../shared';

export type CallCliToolInput = Readonly<{
  toolName: string;
  args: AskToolArgs | AskAllToolArgs;
  configPath?: string;
  onProgress?: (progress: Progress) => void;
}>;

type ToolSchemaProperties = Readonly<Record<string, unknown>>;

type ListedTool = Readonly<{
  name: string;
  inputSchema?: Readonly<{ properties?: ToolSchemaProperties }>;
}>;

const CLI_ARG_LABELS: Readonly<Record<string, string>> = {
  files: '--file',
  working_directory: '--working-dir',
};

const formatCliArgLabel = (argName: string): string => {
  const result = CLI_ARG_LABELS[argName] ?? argName;

  return result;
};

const resolveToolProperties = async (client: Client, toolName: string): Promise<ToolSchemaProperties> => {
  const { tools } = await client.listTools();
  const listedTools = tools as readonly ListedTool[];
  const tool = listedTools.find((candidate) => candidate.name === toolName);

  if (!tool) {
    throw new ValidationError(`CLI tool "${toolName}" is not registered`);
  }

  const result = tool.inputSchema?.properties ?? {};

  return result;
};

const validateSupportedArgs = async (client: Client, input: CallCliToolInput): Promise<void> => {
  const { args, toolName } = input;
  const argNames = Object.keys(args);

  if (!argNames.length) return;

  const toolProperties = await resolveToolProperties(client, toolName);
  const unsupportedArgLabels = argNames
    .filter((argName) => !(argName in toolProperties))
    .map((argName) => formatCliArgLabel(argName));

  if (!unsupportedArgLabels.length) return;

  const joinedLabels = unsupportedArgLabels.map((label) => `"${label}"`).join(', ');
  const noun = unsupportedArgLabels.length === 1 ? 'Argument' : 'Arguments';
  const verb = unsupportedArgLabels.length === 1 ? 'is' : 'are';

  throw new ValidationError(`${noun} ${joinedLabels} ${verb} not supported by ${toolName}`);
};

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

    await validateSupportedArgs(client, input);

    const requestOptions = buildRequestOptions(onProgress);
    const result = await client.callTool({ name: toolName, arguments: args }, undefined, requestOptions);

    return result as CallToolResult;
  } finally {
    await client.close();
    await server.close();
  }
};
