import type { ClientToolTimeout, McpServerEntry, SetupMergeStatus } from './client-target.type';
import type { ProvidersFile } from '../../shared/provider/common';

export type SupportedClient =
  'claude-code' | 'codex' | 'copilot' | 'cursor' | 'gemini' | 'opencode' | 'windsurf' | 'generic';

export type SetupMode = 'merge' | 'overwrite';

export type SetupEnv = Readonly<Record<string, string | undefined>>;

export type SetupBackupPolicy = 'if-exists' | 'always' | 'never';

export type SetupWriteIntent = 'write' | 'skip' | 'manual';

export type SetupOutputMode = 'human' | 'json';

export type SetupFileStat = {
  readonly mode: number;
  isFile(): boolean;
};

export type SetupWriteOptions = {
  readonly encoding: 'utf8';
  readonly mode: number;
};

export type SetupMkdirOptions = {
  readonly recursive: boolean;
};

export type SetupFs = {
  readonly mkdir: (targetPath: string, options: SetupMkdirOptions) => Promise<void>;
  readonly readFile: (targetPath: string, encoding: 'utf8') => Promise<string>;
  readonly rename: (sourcePath: string, destinationPath: string) => Promise<void>;
  readonly writeFile: (targetPath: string, content: string, options: SetupWriteOptions) => Promise<void>;
  readonly realpath: (targetPath: string) => Promise<string>;
  readonly copyFile: (sourcePath: string, destinationPath: string, mode?: number) => Promise<void>;
  readonly stat: (targetPath: string) => Promise<SetupFileStat>;
};

export type ClientConfigTemplate = {
  readonly client: SupportedClient;
  readonly configPath?: string;
  readonly label: string;
};

export type DetectedProvider = {
  readonly name: string;
  readonly available: boolean;
  readonly binaryPath?: string;
};

export type SetupPlan = {
  readonly client: SupportedClient;
  readonly mode: SetupMode;
  readonly backup: SetupBackupPolicy;
  readonly dryRun: boolean;
  readonly writeIntent: SetupWriteIntent;
  readonly targetPath?: string;
  readonly mergeStatusPreview: SetupMergeStatus;
  readonly configText: string;
  readonly warnings: string[];
  readonly notes: string[];
};

export type SetupPlanInput = {
  readonly client: SupportedClient;
  readonly homeDirectory: string;
  readonly pathOverride?: string;
  readonly mode: SetupMode;
  readonly dryRun: boolean;
  readonly existingConfigText?: string;
  readonly agenticServerEntry: McpServerEntry;
  readonly backup: SetupBackupPolicy;
  readonly env?: SetupEnv;
  readonly toolTimeout?: ClientToolTimeout;
};

type SetupApplyStatus = 'written' | 'skipped' | 'manual' | 'verification-failed';

export type SetupApplyResult = {
  readonly status: SetupApplyStatus;
  readonly path?: string;
  readonly backupPath?: string;
  readonly reason?: string;
};

export type ParsedSetupArgs = {
  readonly client: SupportedClient;
  readonly dryRun: boolean;
  readonly yes: boolean;
  readonly output: SetupOutputMode;
  readonly mode: SetupMode;
  readonly pathOverride?: string;
  readonly backup: SetupBackupPolicy;
  readonly minimal: boolean;
};

export type SkillInstallResult = {
  readonly status: 'installed' | 'already-exists' | 'error';
  readonly skillPath: string;
  readonly reason?: string;
};

export type SkillInstallDependencies = {
  readonly homeDirectory: string;
  readonly mkdir: (path: string, options: SetupMkdirOptions) => Promise<void>;
  readonly writeFile: (path: string, content: string, encoding: 'utf8') => Promise<void>;
  readonly readFile: (path: string, encoding: 'utf8') => Promise<string>;
};

export type SetupCliDependencies = {
  readonly detectInstalledProviders: () => Promise<DetectedProvider[]>;
  readonly generateClientConfigEntry: (
    client: SupportedClient,
    detectedProviders: DetectedProvider[],
    toolTimeoutMs: number
  ) => McpServerEntry;
  readonly loadProvidersConfig: () => Promise<ProvidersFile>;
  readonly buildSetupPlan: (input: SetupPlanInput) => SetupPlan;
  readonly applySetupPlan: (plan: SetupPlan) => Promise<SetupApplyResult>;
  readonly installSkill: (injectedDependencies?: Partial<SkillInstallDependencies>) => Promise<SkillInstallResult>;
  readonly homeDirectory: string;
  readonly stdoutWrite: (text: string) => void;
  readonly stderrWrite: (text: string) => void;
  readonly isInteractive: boolean;
  readonly promptConfirm: (question: string) => Promise<boolean>;
  readonly readConfigFile: (path: string) => Promise<string>;
  readonly env: SetupEnv;
};

export type SetupResult = {
  readonly client: SupportedClient;
  readonly detectedProviders: DetectedProvider[];
  readonly configJson: string;
  readonly configPath?: string;
  readonly written: boolean;
};

export type ConfiguredSetupOutputInput = {
  readonly parsedArgs: ParsedSetupArgs;
  readonly plan: SetupPlan;
  readonly result: SetupApplyResult;
  readonly detectedProviders: DetectedProvider[];
  readonly skillResult?: SkillInstallResult;
};

export type MinimalSetupOutputInput = {
  readonly client: SupportedClient;
  readonly detectedProviders: DetectedProvider[];
  readonly skillResult: SkillInstallResult;
};
