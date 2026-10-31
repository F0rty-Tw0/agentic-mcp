export type SupportedClient = 'claude-code' | 'copilot' | 'cursor' | 'gemini' | 'windsurf' | 'generic';

export type SetupMode = 'merge' | 'overwrite';

export type SetupBackupPolicy = 'if-exists' | 'always' | 'never';

export type SetupWriteIntent = 'write' | 'skip' | 'manual';

export type SetupMergeStatus = 'created' | 'merged' | 'unchanged' | 'invalid-json';

export type SetupOutputMode = 'human' | 'json';

export type StdioServerEntry = {
  readonly command: string;
  readonly args: string[];
  readonly timeout?: number;
};

export type CopilotServerEntry = {
  readonly type: 'local';
  readonly command: string;
  readonly args: string[];
  readonly tools: string[];
  readonly timeout: number;
};

export type McpServerEntry = StdioServerEntry | CopilotServerEntry;

export type ClientTarget = {
  readonly configPath?: string;
  readonly serversKey: string;
  readonly timeoutKeys: string[];
  readonly preservedKeys: string[];
};

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
    detectedProviders: DetectedProvider[]
  ) => McpServerEntry;
  readonly buildSetupPlan: (input: SetupPlanInput) => SetupPlan;
  readonly applySetupPlan: (plan: SetupPlan) => Promise<SetupApplyResult>;
  readonly installSkill: (injectedDependencies?: Partial<SkillInstallDependencies>) => Promise<SkillInstallResult>;
  readonly homeDirectory: string;
  readonly stdoutWrite: (text: string) => void;
  readonly stderrWrite: (text: string) => void;
  readonly isInteractive: boolean;
  readonly promptConfirm: (question: string) => Promise<boolean>;
  readonly readConfigFile: (path: string) => Promise<string>;
};

export type SetupResult = {
  readonly client: SupportedClient;
  readonly detectedProviders: DetectedProvider[];
  readonly configJson: string;
  readonly configPath?: string;
  readonly written: boolean;
};

export type MinimalSetupOutputInput = {
  readonly client: SupportedClient;
  readonly detectedProviders: DetectedProvider[];
  readonly skillResult: SkillInstallResult;
};
