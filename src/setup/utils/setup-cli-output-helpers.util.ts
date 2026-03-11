import type {
  DetectedProvider,
  ParsedSetupArgs,
  SetupApplyResult,
  SkillInstallResult,
  SupportedClient,
} from '../common';

export type MinimalSetupOutputInput = Readonly<{
  client: SupportedClient;
  detectedProviders: readonly DetectedProvider[];
  skillResult: SkillInstallResult;
}>;

export type OutputNextStep = Readonly<{
  command: string;
  kind: 'ask' | 'diagnostic' | 'setup';
  purpose: string;
}>;

export type OutputSummary = Readonly<{
  completedSteps: readonly string[];
  unproven: readonly string[];
  nextStep: OutputNextStep;
  firstAskCommand?: string;
}>;

const FIRST_ASK_PROMPT = 'Reply with OK and your provider name.';

const buildSetupCommand = (client: SupportedClient): string => {
  return `npx agentic-mcp setup --client ${client} --yes`;
};

const buildFirstAskCommand = (providerName: string): string => {
  return `npx agentic-mcp ask_${providerName} "${FIRST_ASK_PROMPT}"`;
};

const resolveFirstAskCommand = (detectedProviders: readonly DetectedProvider[]): string | undefined => {
  const detectedProvider = detectedProviders.find((provider) => provider.available);

  if (!detectedProvider) {
    return undefined;
  }

  return buildFirstAskCommand(detectedProvider.name);
};

export const formatProviderSummary = (detectedProviders: readonly DetectedProvider[]): string => {
  const lines = detectedProviders.map((provider) => {
    const status = provider.available ? `✓ ${provider.binaryPath}` : '✗ not found';

    return `  ${provider.name}: ${status}`;
  });

  return lines.join('\n');
};

export const buildProviderBlock = (detectedProviders: readonly DetectedProvider[]): string => {
  const providerSummary = formatProviderSummary(detectedProviders);

  if (providerSummary !== '') {
    return providerSummary;
  }

  return '  (none detected)';
};

export const buildConfiguredSummary = (
  args: ParsedSetupArgs,
  result: SetupApplyResult,
  detectedProviders: readonly DetectedProvider[]
): OutputSummary => {
  const firstAskCommand = resolveFirstAskCommand(detectedProviders);
  const completedSteps = [`Prepared ${args.mode} setup for ${args.client}.`, `Setup result: ${result.status}.`];

  if (result.path != null) {
    completedSteps.push(`Path: ${result.path}`);
  }

  if (result.backupPath != null) {
    completedSteps.push(`Backup: ${result.backupPath}`);
  }

  if (result.reason != null) {
    completedSteps.push(`Reason: ${result.reason}`);
  }

  if (firstAskCommand != null) {
    return {
      completedSteps,
      unproven: [
        'Provider authentication has not been proven yet.',
        'A real provider response through agentic-mcp has not been proven yet.',
      ],
      nextStep: {
        command: firstAskCommand,
        kind: 'ask',
        purpose: 'Prove a real provider response through agentic-mcp.',
      },
    };
  }

  return {
    completedSteps,
    unproven: [
      'No provider CLI is currently detected.',
      'A real provider response through agentic-mcp has not been proven yet.',
    ],
    nextStep: {
      command: 'npx agentic-mcp list_providers',
      kind: 'diagnostic',
      purpose: 'Rerun this after installing and authenticating a provider CLI.',
    },
  };
};

export const formatSkillOutput = (skillResult: SkillInstallResult): string => {
  switch (skillResult.status) {
    case 'installed':
      return `Skill installed: ${skillResult.skillPath}\n`;
    case 'already-exists':
      return `Skill already up to date: ${skillResult.skillPath}\n`;
    case 'error':
      return `Skill install failed: ${skillResult.reason ?? 'unknown error'}\n`;
    default:
      return '';
  }
};

export const buildMinimalSummary = (input: MinimalSetupOutputInput): OutputSummary => {
  const setupCommand = buildSetupCommand(input.client);
  const firstAskCommand = resolveFirstAskCommand(input.detectedProviders);
  const completedSteps = [
    `Suggested client setup command: ${setupCommand}`,
    formatSkillOutput(input.skillResult).trimEnd(),
  ];

  return {
    completedSteps,
    unproven: [
      'MCP client configuration has not been written yet.',
      'Provider authentication has not been proven yet.',
      'A real provider response through agentic-mcp has not been proven yet.',
    ],
    nextStep: {
      command: setupCommand,
      kind: 'setup',
      purpose: 'Write the MCP client configuration entry.',
    },
    firstAskCommand,
  };
};

export const buildMinimalNextSteps = (input: MinimalSetupOutputInput): readonly string[] => {
  const steps = [buildSetupCommand(input.client), 'npx agentic-mcp list_providers'];
  const firstAskCommand = resolveFirstAskCommand(input.detectedProviders);

  if (firstAskCommand != null) {
    steps.push(firstAskCommand);
  }

  return steps;
};
