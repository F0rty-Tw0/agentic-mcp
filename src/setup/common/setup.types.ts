export const SUPPORTED_CLIENTS = ['claude-code', 'cursor', 'windsurf', 'generic'] as const;

export type SupportedClient = (typeof SUPPORTED_CLIENTS)[number];

export type ClientConfigTemplate = Readonly<{
  client: SupportedClient;
  configPath: string | null;
  label: string;
}>;

export type DetectedProvider = Readonly<{
  name: string;
  available: boolean;
  binaryPath: string | null;
}>;

export type SetupResult = Readonly<{
  client: SupportedClient;
  detectedProviders: readonly DetectedProvider[];
  configJson: string;
  configPath: string | null;
  written: boolean;
}>;
