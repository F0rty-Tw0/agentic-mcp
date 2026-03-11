export const SUPPORTED_CLIENTS = ['claude-code', 'cursor', 'windsurf', 'generic'] as const;

export type SupportedClient = (typeof SUPPORTED_CLIENTS)[number];

export type SetupMode = 'merge' | 'overwrite';

export type SetupBackupPolicy = 'if-exists' | 'always' | 'never';

export type SetupWriteIntent = 'write' | 'skip' | 'manual';

export type SetupMergeStatus = 'created' | 'merged' | 'unchanged' | 'invalid-json';

export type SetupOutputMode = 'human' | 'json';

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
  configPath?: string;
  label: string;
}>;

export type DetectedProvider = Readonly<{
  name: string;
  available: boolean;
  binaryPath?: string;
}>;

export type SetupPlan = Readonly<{
  client: SupportedClient;
  mode: SetupMode;
  backup: SetupBackupPolicy;
  dryRun: boolean;
  writeIntent: SetupWriteIntent;
  targetPath?: string;
  mergeStatusPreview: SetupMergeStatus;
  configText: string;
  warnings: readonly string[];
}>;

export type SetupPlanInput = Readonly<{
  client: SupportedClient;
  homeDirectory: string;
  pathOverride?: string;
  mode: SetupMode;
  dryRun: boolean;
  existingConfigText?: string;
  agenticServerEntry: McpServerEntry;
  backup: SetupBackupPolicy;
}>;

export type SetupApplyStatus = 'written' | 'skipped' | 'manual' | 'verification-failed';

export type SetupApplyResult = Readonly<{
  status: SetupApplyStatus;
  path?: string;
  backupPath?: string;
  reason?: string;
}>;

export type ParsedSetupArgs = Readonly<{
  client: SupportedClient;
  dryRun: boolean;
  yes: boolean;
  output: SetupOutputMode;
  mode: SetupMode;
  pathOverride?: string;
  backup: SetupBackupPolicy;
  minimal: boolean;
}>;

export type SkillInstallResult = Readonly<{
  status: 'installed' | 'already-exists' | 'error';
  skillPath: string;
  reason?: string;
}>;

export type SkillInstallDependencies = Readonly<{
  homeDirectory: string;
  mkdir: (path: string, options: { recursive: boolean }) => Promise<void>;
  writeFile: (path: string, content: string, encoding: 'utf8') => Promise<void>;
  readFile: (path: string, encoding: 'utf8') => Promise<string>;
}>;

export type SetupCliDependencies = Readonly<{
  detectInstalledProviders: () => Promise<readonly DetectedProvider[]>;
  generateClientConfigEntry: (
    client: SupportedClient,
    detectedProviders: readonly DetectedProvider[]
  ) => McpServerEntry;
  buildSetupPlan: (input: SetupPlanInput) => SetupPlan;
  applySetupPlan: (plan: SetupPlan) => Promise<SetupApplyResult>;
  installSkill: (injectedDependencies?: Partial<SkillInstallDependencies>) => Promise<SkillInstallResult>;
  homeDirectory: string;
  stdoutWrite: (text: string) => void;
  stderrWrite: (text: string) => void;
  isInteractive: boolean;
  promptConfirm: (question: string) => Promise<boolean>;
  readConfigFile: (path: string) => Promise<string>;
}>;

export type SetupResult = Readonly<{
  client: SupportedClient;
  detectedProviders: readonly DetectedProvider[];
  configJson: string;
  configPath?: string;
  written: boolean;
}>;
