export const SUPPORTED_CLIENTS = ['claude-code', 'cursor', 'windsurf', 'generic'] as const;

export type SupportedClient = (typeof SUPPORTED_CLIENTS)[number];

export type SetupMode = 'merge' | 'overwrite';

export type SetupBackupPolicy = 'if-exists' | 'always' | 'never';

export type SetupWriteIntent = 'write' | 'skip' | 'manual';

export type SetupMergeStatus = 'created' | 'merged' | 'unchanged' | 'invalid-json';

export type McpServerEntry = Readonly<{
  command: string;
  args: readonly string[];
}>;

export type SetupFileStat = Readonly<{
  isFile(): boolean;
}>;

export type SetupFs = Readonly<{
  mkdir: (targetPath: string, options: { recursive: boolean }) => Promise<void>;
  readFile: (targetPath: string, encoding: 'utf8') => Promise<string>;
  rename: (sourcePath: string, destinationPath: string) => Promise<void>;
  writeFile: (targetPath: string, content: string, encoding: 'utf8') => Promise<void>;
  copyFile: (sourcePath: string, destinationPath: string, mode?: number) => Promise<void>;
  stat: (targetPath: string) => Promise<SetupFileStat>;
}>;

export type ClientConfigTemplate = Readonly<{
  client: SupportedClient;
  configPath: string | undefined;
  label: string;
}>;

export type DetectedProvider = Readonly<{
  name: string;
  available: boolean;
  binaryPath: string | undefined;
}>;

export type SetupPlan = Readonly<{
  client: SupportedClient;
  mode: SetupMode;
  backup: SetupBackupPolicy;
  dryRun: boolean;
  writeIntent: SetupWriteIntent;
  targetPath: string | undefined;
  mergeStatusPreview: SetupMergeStatus;
  configText: string;
  warnings: readonly string[];
}>;

export type SetupApplyStatus = 'written' | 'skipped' | 'manual' | 'verification-failed';

export type SetupApplyResult = Readonly<{
  status: SetupApplyStatus;
  path: string | undefined;
  backupPath: string | undefined;
  reason?: string;
}>;

export type SetupResult = Readonly<{
  client: SupportedClient;
  detectedProviders: readonly DetectedProvider[];
  configJson: string;
  configPath: string | undefined;
  written: boolean;
}>;
