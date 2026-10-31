export {
  CLIENT_TARGETS,
  CLIENT_TOOL_TIMEOUT_MS,
  CLIENT_TOOL_TIMEOUT_SEC,
  CODEX_STARTUP_TIMEOUT_SEC,
  KNOWN_PROVIDER_COMMANDS,
  SUPPORTED_CLIENTS,
} from './setup.const';

export { SKILL_CONTENT } from './skill-content';

export type {
  ClientConfigFormat,
  ClientConfigMergeResult,
  ClientTarget,
  CodexServerEntry,
  CopilotServerEntry,
  McpServerEntry,
  OpenCodeServerEntry,
  SetupMergeStatus,
  StdioServerEntry,
  TimeoutKeyRule,
} from './client-target.type';

export type {
  ClientConfigTemplate,
  DetectedProvider,
  MinimalSetupOutputInput,
  ParsedSetupArgs,
  SetupApplyResult,
  SetupBackupPolicy,
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
