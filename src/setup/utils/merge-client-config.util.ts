import type { McpServerEntry } from '../common';

type MergeClientConfigInput = Readonly<{
  existingConfigText?: string;
  agenticServerEntry: McpServerEntry;
}>;

type MergeResultStatus = 'created' | 'merged' | 'unchanged' | 'invalid-json';

type MergeClientConfigResult = Readonly<{
  status: MergeResultStatus;
  mergedConfig: Readonly<Record<string, unknown>>;
  reason?: string;
}>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const normalizeMcpServers = (value: unknown): Readonly<Record<string, unknown>> => {
  if (!isRecord(value)) {
    const emptyServers: Readonly<Record<string, unknown>> = {};

    return emptyServers;
  }

  const servers: Readonly<Record<string, unknown>> = value;

  return servers;
};

const createBaseConfig = (agenticServerEntry: McpServerEntry): Readonly<Record<string, unknown>> => {
  const result: Readonly<Record<string, unknown>> = {
    mcpServers: {
      'agentic-mcp': agenticServerEntry,
    },
  };

  return result;
};

const parseExistingConfig = (existingConfigText: string): Readonly<{ parsedConfig: unknown } | { reason: string }> => {
  try {
    const parsedConfig: unknown = JSON.parse(existingConfigText);
    const parsedResult: Readonly<{ parsedConfig: unknown }> = { parsedConfig };

    return parsedResult;
  } catch (error: unknown) {
    const reason = error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON';
    const failureResult: Readonly<{ reason: string }> = { reason };

    return failureResult;
  }
};

const createUnchangedConfig = (
  parsedRoot: Readonly<Record<string, unknown>>,
  currentServers: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const result: Readonly<Record<string, unknown>> = {
    ...parsedRoot,
    mcpServers: currentServers,
  };

  return result;
};

const createMergedConfig = (
  parsedRoot: Readonly<Record<string, unknown>>,
  currentServers: Readonly<Record<string, unknown>>,
  agenticServerEntry: McpServerEntry
): Readonly<Record<string, unknown>> => {
  const result: Readonly<Record<string, unknown>> = {
    ...parsedRoot,
    mcpServers: {
      ...currentServers,
      'agentic-mcp': agenticServerEntry,
    },
  };

  return result;
};

export const buildMergedClientConfig = (input: MergeClientConfigInput): MergeClientConfigResult => {
  const createdConfig = createBaseConfig(input.agenticServerEntry);

  if (input.existingConfigText == null || input.existingConfigText.trim() === '') {
    const createdResult: MergeClientConfigResult = {
      status: 'created',
      mergedConfig: createdConfig,
    };

    return createdResult;
  }

  const parseResult = parseExistingConfig(input.existingConfigText);

  if ('reason' in parseResult) {
    const invalidJsonResult: MergeClientConfigResult = {
      status: 'invalid-json',
      mergedConfig: createdConfig,
      reason: parseResult.reason,
    };

    return invalidJsonResult;
  }

  const parsedRoot = isRecord(parseResult.parsedConfig) ? parseResult.parsedConfig : {};
  const currentServers = normalizeMcpServers(parsedRoot.mcpServers);
  const currentAgentic = currentServers['agentic-mcp'];

  if (JSON.stringify(currentAgentic) === JSON.stringify(input.agenticServerEntry)) {
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
