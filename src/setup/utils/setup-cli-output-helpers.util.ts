import type {
  DetectedProvider,
  MinimalSetupOutputInput,
  ParsedSetupArgs,
  SetupApplyResult,
  SkillInstallResult,
  SupportedClient,
} from '../common';

type OutputNextStep = {
  readonly command: string;
  readonly kind: 'prove' | 'diagnostic' | 'setup';
  readonly purpose: string;
};

type OutputSummary = {
  readonly completedSteps: string[];
  readonly unproven: string[];
  readonly nextStep: OutputNextStep;
  readonly firstProofCommand?: string;
};

const buildSetupCommand = (client: SupportedClient): string => {
  return `npx agentic-mcp setup --client ${client} --yes`;
};

const buildFirstProofCommand = (providerName: string): string => {
  return `npx agentic-mcp prove ${providerName}`;
};

const resolveFirstProofCommand = (detectedProviders: DetectedProvider[]): string | undefined => {
  const detectedProvider = detectedProviders.find((provider) => provider.available);

  if (!detectedProvider) return undefined;

  return buildFirstProofCommand(detectedProvider.name);
};

export const formatProviderSummary = (detectedProviders: DetectedProvider[]): string => {
  const lines = detectedProviders.map((provider) => {
    const status = provider.available ? `✓ ${provider.binaryPath}` : '✗ not found';

    return `  ${provider.name}: ${status}`;
  });

  return lines.join('\n');
};

export const buildProviderBlock = (detectedProviders: DetectedProvider[]): string => {
  const providerSummary = formatProviderSummary(detectedProviders);

  if (providerSummary !== '') return providerSummary;

  return '  (none detected)';
};

export const buildConfiguredSummary = (
  args: ParsedSetupArgs,
  result: SetupApplyResult,
  detectedProviders: DetectedProvider[]
): OutputSummary => {
  const firstProofCommand = resolveFirstProofCommand(detectedProviders);
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

  if (firstProofCommand != null) {
    const proveNextStep: OutputNextStep = {
      command: firstProofCommand,
      kind: 'prove',
      purpose: 'Prove a real provider response through agentic-mcp.',
    };
    const proveSummary: OutputSummary = {
      completedSteps,
      unproven: [
        'Provider authentication has not been proven yet.',
        'A real provider response through agentic-mcp has not been proven yet.',
      ],
      nextStep: proveNextStep,
    };

    return proveSummary;
  }

  const diagnosticNextStep: OutputNextStep = {
    command: 'npx agentic-mcp list_providers',
    kind: 'diagnostic',
    purpose: 'Rerun this after installing and authenticating a provider CLI.',
  };
  const diagnosticSummary: OutputSummary = {
    completedSteps,
    unproven: [
      'No provider CLI is currently detected.',
      'A real provider response through agentic-mcp has not been proven yet.',
    ],
    nextStep: diagnosticNextStep,
  };

  return diagnosticSummary;
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
  const firstProofCommand = resolveFirstProofCommand(input.detectedProviders);
  const completedSteps = [
    `Suggested client setup command: ${setupCommand}`,
    formatSkillOutput(input.skillResult).trimEnd(),
  ];

  const setupNextStep: OutputNextStep = {
    command: setupCommand,
    kind: 'setup',
    purpose: 'Write the MCP client configuration entry.',
  };
  const minimalSummary: OutputSummary = {
    completedSteps,
    unproven: [
      'MCP client configuration has not been written yet.',
      'Provider authentication has not been proven yet.',
      'A real provider response through agentic-mcp has not been proven yet.',
    ],
    nextStep: setupNextStep,
    firstProofCommand,
  };

  return minimalSummary;
};

export const buildMinimalNextSteps = (input: MinimalSetupOutputInput): string[] => {
  const steps = [buildSetupCommand(input.client), 'npx agentic-mcp list_providers'];
  const firstProofCommand = resolveFirstProofCommand(input.detectedProviders);

  if (firstProofCommand != null) {
    steps.push(firstProofCommand);
  }

  return steps;
};
