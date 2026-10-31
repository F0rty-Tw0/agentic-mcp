import { CODEX_STARTUP_TIMEOUT_SEC } from '../common';
import type {
  CodexServerEntry,
  CopilotServerEntry,
  DetectedProvider,
  McpServerEntry,
  OpenCodeServerEntry,
  StdioServerEntry,
  SupportedClient,
} from '../common';

const MS_PER_SECOND = 1000;

const BASE_ENTRY: StdioServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
};

const buildTimedEntry = (toolTimeoutMs: number): StdioServerEntry => {
  const timedEntry: StdioServerEntry = { ...BASE_ENTRY, timeout: toolTimeoutMs };

  return timedEntry;
};

// Codex reads both timeouts in seconds from ~/.codex/config.toml; rounding up never cuts the limit short.
const buildCodexEntry = (toolTimeoutMs: number): CodexServerEntry => {
  const toolTimeoutSec = Math.ceil(toolTimeoutMs / MS_PER_SECOND);
  const codexEntry: CodexServerEntry = {
    command: BASE_ENTRY.command,
    args: BASE_ENTRY.args,
    tool_timeout_sec: toolTimeoutSec,
    startup_timeout_sec: CODEX_STARTUP_TIMEOUT_SEC,
  };

  return codexEntry;
};

// Copilot CLI requires `tools` on a local server.
const buildCopilotEntry = (toolTimeoutMs: number): CopilotServerEntry => {
  const copilotEntry: CopilotServerEntry = {
    type: 'local',
    command: BASE_ENTRY.command,
    args: BASE_ENTRY.args,
    tools: ['*'],
    timeout: toolTimeoutMs,
  };

  return copilotEntry;
};

// OpenCode takes the command and its arguments as one array.
const buildOpenCodeEntry = (toolTimeoutMs: number): OpenCodeServerEntry => {
  const openCodeEntry: OpenCodeServerEntry = {
    type: 'local',
    command: [BASE_ENTRY.command, ...BASE_ENTRY.args],
    enabled: true,
    timeout: toolTimeoutMs,
  };

  return openCodeEntry;
};

export const generateClientConfigEntry = (
  client: SupportedClient,
  detectedProviders: DetectedProvider[],
  toolTimeoutMs: number
): McpServerEntry => {
  const hasAnyAvailableProvider = detectedProviders.some((provider) => provider.available);

  switch (client) {
    case 'claude-code':
      return BASE_ENTRY;
    case 'gemini':
      return buildTimedEntry(toolTimeoutMs);
    case 'codex':
      return buildCodexEntry(toolTimeoutMs);
    case 'copilot':
      return buildCopilotEntry(toolTimeoutMs);
    case 'opencode':
      return buildOpenCodeEntry(toolTimeoutMs);
    case 'cursor':
    case 'windsurf':
      // Intentionally explicit per-client branches to support project-specific overrides later.
      return BASE_ENTRY;
    case 'generic':
      // TODO: Use provider availability to adjust the generic entry for project-specific defaults.
      if (hasAnyAvailableProvider) return BASE_ENTRY;

      // TODO: Keep this explicit fallback to make future generic behavior changes intentional.
      return BASE_ENTRY;
    default:
      // Intentionally keep a default branch for future client additions.
      return BASE_ENTRY;
  }
};
