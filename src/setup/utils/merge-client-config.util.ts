import type { McpServerEntry } from '../common';

type MergeClientConfigInput = {
  readonly existingConfigText?: string;
  readonly agenticServerEntry: McpServerEntry;
};

type MergeResultStatus = 'created' | 'merged' | 'unchanged' | 'invalid-json';

type JsonRecord = Readonly<Record<string, unknown>>;

type MergeClientConfigResult = {
  readonly status: MergeResultStatus;
  readonly mergedConfig: JsonRecord;
  readonly reason?: string;
};

type ParsedConfigSuccess = {
  readonly parsedConfig: unknown;
};

type ParsedConfigFailure = {
  readonly reason: string;
};

type ParsedConfigResult = ParsedConfigSuccess | ParsedConfigFailure;

const isRecord = (value: unknown): value is JsonRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const normalizeMcpServers = (value: unknown): JsonRecord => {
  if (!isRecord(value)) {
    const emptyServers: JsonRecord = {};

    return emptyServers;
  }

  const servers: JsonRecord = value;

  return servers;
};

const createBaseConfig = (agenticServerEntry: McpServerEntry): JsonRecord => {
  const mcpServers = { 'agentic-mcp': agenticServerEntry };
  const result: JsonRecord = { mcpServers };

  return result;
};

const parseExistingConfig = (existingConfigText: string): ParsedConfigResult => {
  try {
    const parsedConfig: unknown = JSON.parse(existingConfigText);
    const parsedResult: ParsedConfigSuccess = { parsedConfig };

    return parsedResult;
  } catch (error: unknown) {
    const reason = error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON';
    const failureResult: ParsedConfigFailure = { reason };

    return failureResult;
  }
};

const createUnchangedConfig = (parsedRoot: JsonRecord, currentServers: JsonRecord): JsonRecord => {
  const result: JsonRecord = {
    ...parsedRoot,
    mcpServers: currentServers,
  };

  return result;
};

const createMergedConfig = (
  parsedRoot: JsonRecord,
  currentServers: JsonRecord,
  agenticServerEntry: McpServerEntry
): JsonRecord => {
  const mcpServers = { ...currentServers, 'agentic-mcp': agenticServerEntry };
  const result: JsonRecord = {
    ...parsedRoot,
    mcpServers,
  };

  return result;
};

export const buildMergedClientConfig = (input: MergeClientConfigInput): MergeClientConfigResult => {
  const { existingConfigText } = input;
  const createdConfig = createBaseConfig(input.agenticServerEntry);
  const createdResult: MergeClientConfigResult = {
    status: 'created',
    mergedConfig: createdConfig,
  };

  if (existingConfigText == null) return createdResult;

  const trimmedConfigText = existingConfigText.trim();

  if (trimmedConfigText === '') return createdResult;

  const parseResult = parseExistingConfig(existingConfigText);

  if ('reason' in parseResult) {
    const invalidJsonResult: MergeClientConfigResult = {
      status: 'invalid-json',
      mergedConfig: createdConfig,
      reason: parseResult.reason,
    };

    return invalidJsonResult;
  }

  const emptyRoot: JsonRecord = {};
  const parsedRoot = isRecord(parseResult.parsedConfig) ? parseResult.parsedConfig : emptyRoot;
  const currentServers = normalizeMcpServers(parsedRoot.mcpServers);
  const currentAgentic = currentServers['agentic-mcp'];
  const currentAgenticJson = JSON.stringify(currentAgentic);
  const agenticServerEntryJson = JSON.stringify(input.agenticServerEntry);

  if (currentAgenticJson === agenticServerEntryJson) {
    const unchangedResult: MergeClientConfigResult = {
      status: 'unchanged',
      mergedConfig: createUnchangedConfig(parsedRoot, currentServers),
    };

    return unchangedResult;
  }

  const mergedConfig = createMergedConfig(parsedRoot, currentServers, input.agenticServerEntry);

  const mergedResult: MergeClientConfigResult = {
    status: 'merged',
    mergedConfig,
  };

  return mergedResult;
};
