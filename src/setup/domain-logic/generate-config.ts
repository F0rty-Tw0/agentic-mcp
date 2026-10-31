import { CODEX_STARTUP_TIMEOUT_SEC } from '../common';
import type {
  AntigravityServerEntry,
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

// Antigravity reads timeoutSeconds in seconds from ~/.gemini/config/mcp_config.json; rounding up never cuts it short.
const buildAntigravityEntry = (toolTimeoutMs: number): AntigravityServerEntry => {
  const timeoutSeconds = Math.ceil(toolTimeoutMs / MS_PER_SECOND);
  const antigravityEntry: AntigravityServerEntry = {
    command: BASE_ENTRY.command,
    args: BASE_ENTRY.args,
    timeoutSeconds,
  };

  return antigravityEntry;
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

type TimedEntryBuilder = (toolTimeoutMs: number) => McpServerEntry;

// Claude Code, Cursor, Windsurf and generic get no timeout key, so they use the base entry.
const TIMED_ENTRY_BUILDERS: Readonly<Partial<Record<SupportedClient, TimedEntryBuilder>>> = {
  antigravity: buildAntigravityEntry,
  codex: buildCodexEntry,
  copilot: buildCopilotEntry,
  gemini: buildTimedEntry,
  opencode: buildOpenCodeEntry,
};

export const generateClientConfigEntry = (
  client: SupportedClient,
  _detectedProviders: DetectedProvider[],
  toolTimeoutMs: number
): McpServerEntry => {
  const buildClientEntry = TIMED_ENTRY_BUILDERS[client];

  if (buildClientEntry == null) return BASE_ENTRY;

  const clientEntry = buildClientEntry(toolTimeoutMs);

  return clientEntry;
};
