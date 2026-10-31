export {
  CLIENT_TARGETS,
  CLIENT_TIMEOUT_MARGIN_MS,
  CLIENT_TOOL_TIMEOUT_MS,
  CODEX_STARTUP_TIMEOUT_SEC,
  KNOWN_PROVIDER_COMMANDS,
  SUPPORTED_CLIENTS,
} from './setup.const';

export { SKILL_CONTENT } from './skill-content';

export type {
  ClientConfigFormat,
  ClientConfigMergeResult,
  ClientTarget,
  ClientToolTimeout,
  ClientToolTimeoutSource,
  CodexServerEntry,
  ConfigPathEnvRule,
  CopilotServerEntry,
  McpServerEntry,
  OpenCodeServerEntry,
  SetupMergeStatus,
  StdioServerEntry,
  TimeoutKeyRule,
  TomlRewriteCause,
} from './client-target.type';

export type { ParsedTomlFailure, ParsedTomlResult, ParsedTomlSuccess, TomlRecord } from './toml-parse.type';

export type {
  ClientConfigTemplate,
  ConfiguredSetupOutputInput,
  DetectedProvider,
  MinimalSetupOutputInput,
  ParsedSetupArgs,
  SetupApplyResult,
  SetupBackupPolicy,
  SetupEnv,
  SetupCliDependencies,
  SetupFileStat,
  SetupWriteOptions,
  SetupFs,
  SetupMkdirOptions,
  SetupMode,
  SetupOutputMode,
  SetupPlan,
  SetupPlanInput,
  SetupResult,
  SetupWriteIntent,
  SkillInstallDependencies,
  SkillInstallResult,
  SupportedClient,
} from './setup.type';
