import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { CallToolResult } from '@modelcontextprotocol/client';

import { createServer } from '../../server';
import { APP_VERSION, DEFAULT_MCP_TOOL_TIMEOUT_MS, ValidationError } from '../../shared';
import type { CallCliToolInput } from '../common';

type ToolSchemaProperties = Readonly<Record<string, unknown>>;

type CliRequestOptions = {
  readonly onprogress: CallCliToolInput['onProgress'];
  readonly resetTimeoutOnProgress: true;
  readonly timeout: number;
};

const CLI_ARG_LABELS: Readonly<Record<string, string>> = {
  files: '--file',
  working_directory: '--working-dir',
};

const formatCliArgLabel = (argName: string): string => {
  const result = CLI_ARG_LABELS[argName] ?? argName;

  return result;
};

const resolveProviderNames = (toolName: string): string[] | undefined => {
  const match = /^(?:ask|review|ping|help|sessions)_(.+)$/.exec(toolName);

  if (!match) return;

  if (toolName === 'ask_all') return;

  const providerName = match[1];

  if (providerName === undefined) return;

  const result = [providerName];

  return result;
};

const buildUnknownToolErrorMessage = (toolName: string): string => {
  const providerNames = resolveProviderNames(toolName);

  if (providerNames?.length === 1) return `Provider "${providerNames[0]}" not found`;

  return `CLI tool "${toolName}" is not registered`;
};

const resolveToolProperties = async (client: Client, toolName: string): Promise<ToolSchemaProperties> => {
  const { tools } = await client.listTools();
  const tool = tools.find((candidate) => candidate.name === toolName);

  if (!tool) throw new ValidationError(buildUnknownToolErrorMessage(toolName));

  const result = tool.inputSchema.properties ?? {};

  return result;
};

const validateSupportedArgs = async (client: Client, input: CallCliToolInput): Promise<void> => {
  const { args, toolName } = input;
  const argNames = Object.keys(args);

  if (!argNames.length) return;

  const toolProperties = await resolveToolProperties(client, toolName);
  const unsupportedArgNames = argNames.filter((argName) => !(argName in toolProperties));
  const unsupportedArgLabels = unsupportedArgNames.map((argName) => formatCliArgLabel(argName));

  if (!unsupportedArgLabels.length) return;

  const joinedLabels = unsupportedArgLabels.map((label) => `"${label}"`).join(', ');
  const noun = unsupportedArgLabels.length === 1 ? 'Argument' : 'Arguments';
  const verb = unsupportedArgLabels.length === 1 ? 'is' : 'are';

  throw new ValidationError(`${noun} ${joinedLabels} ${verb} not supported by ${toolName}`);
};

const buildRequestOptions = (onProgress: CallCliToolInput['onProgress']): CliRequestOptions => {
  const result: CliRequestOptions = {
    onprogress: onProgress,
    resetTimeoutOnProgress: true,
    timeout: DEFAULT_MCP_TOOL_TIMEOUT_MS,
  };

  return result;
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
    const result = await client.callTool({ name: toolName, arguments: args }, requestOptions);

    return result;
  } finally {
    await client.close();
    await server.close();
  }
};
