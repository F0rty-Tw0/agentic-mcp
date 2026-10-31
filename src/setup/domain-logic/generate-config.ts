import { CLIENT_TOOL_TIMEOUT_MS, CLIENT_TOOL_TIMEOUT_SEC, CODEX_STARTUP_TIMEOUT_SEC } from '../common';
import type {
  CodexServerEntry,
  CopilotServerEntry,
  DetectedProvider,
  McpServerEntry,
  OpenCodeServerEntry,
  StdioServerEntry,
  SupportedClient,
} from '../common';

const BASE_ENTRY: StdioServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
};

const TIMED_ENTRY: StdioServerEntry = {
  ...BASE_ENTRY,
  timeout: CLIENT_TOOL_TIMEOUT_MS,
};

// Codex reads both timeouts in seconds from ~/.codex/config.toml.
const CODEX_ENTRY: CodexServerEntry = {
  command: BASE_ENTRY.command,
  args: BASE_ENTRY.args,
  tool_timeout_sec: CLIENT_TOOL_TIMEOUT_SEC,
  startup_timeout_sec: CODEX_STARTUP_TIMEOUT_SEC,
};

// Copilot CLI requires `tools` on a local server.
const COPILOT_ENTRY: CopilotServerEntry = {
  type: 'local',
  command: BASE_ENTRY.command,
  args: BASE_ENTRY.args,
  tools: ['*'],
  timeout: CLIENT_TOOL_TIMEOUT_MS,
};

// OpenCode takes the command and its arguments as one array.
const OPENCODE_ENTRY: OpenCodeServerEntry = {
  type: 'local',
  command: [BASE_ENTRY.command, ...BASE_ENTRY.args],
  enabled: true,
  timeout: CLIENT_TOOL_TIMEOUT_MS,
};

export const generateClientConfigEntry = (
  client: SupportedClient,
  detectedProviders: DetectedProvider[]
): McpServerEntry => {
  const hasAnyAvailableProvider = detectedProviders.some((provider) => provider.available);

  switch (client) {
    case 'claude-code':
    case 'gemini':
      return TIMED_ENTRY;
    case 'codex':
      return CODEX_ENTRY;
    case 'copilot':
      return COPILOT_ENTRY;
    case 'opencode':
      return OPENCODE_ENTRY;
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
