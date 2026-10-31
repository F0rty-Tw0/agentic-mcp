import type { ClientTarget, TimeoutKeyRule } from './client-target.type';
import type { SupportedClient } from './setup.type';
import { DEFAULT_PROVIDER_QUEUE_TIMEOUT_MS } from '../../shared/command-execution/common';
import { DEFAULT_MCP_TOOL_TIMEOUT_MS } from '../../shared/provider/common';

export const CLIENT_TIMEOUT_MARGIN_MS = 60_000;

// A client must outwait a queued call plus one provider run, or it cancels the call and agentic-mcp stops the CLI.
// This is the value for the default limits; setup derives its value from the providers config when it can load it.
export const CLIENT_TOOL_TIMEOUT_MS =
  DEFAULT_PROVIDER_QUEUE_TIMEOUT_MS + DEFAULT_MCP_TOOL_TIMEOUT_MS + CLIENT_TIMEOUT_MARGIN_MS;

export const SUPPORTED_CLIENTS: SupportedClient[] = [
  'claude-code',
  'codex',
  'copilot',
  'cursor',
  'gemini',
  'opencode',
  'windsurf',
  'generic',
];

export const KNOWN_PROVIDER_COMMANDS = ['claude', 'codex', 'copilot', 'gemini', 'agy', 'opencode'] as const;

type ClientTargetMap = Readonly<Record<SupportedClient, ClientTarget>>;

// Codex waits 30 s for a server to start by default; a cold `npx -y agentic-mcp` can take longer.
export const CODEX_STARTUP_TIMEOUT_SEC = 60;

const TIMEOUT_MS_RULE: TimeoutKeyRule = { key: 'timeout' };

const CODEX_TOOL_TIMEOUT_RULE: TimeoutKeyRule = { key: 'tool_timeout_sec' };

// Codex also reads startup_timeout_ms, and startup_timeout_sec wins when both are set.
const CODEX_STARTUP_TIMEOUT_RULE: TimeoutKeyRule = { key: 'startup_timeout_sec', msAliasKey: 'startup_timeout_ms' };

// Claude Code's per-server timeout is a hard wall-clock limit that replaces its default (code.claude.com/docs/en/mcp).
const CLAUDE_CODE_TIMEOUT_NOTE =
  'agentic-mcp timeout: not written for Claude Code. Its default tool-call limit (MCP_TOOL_TIMEOUT, about 28 h) is already longer, and progress notifications reset its 30 min stdio idle limit; a per-server timeout would replace that default with a hard limit.';

// configPathEnvKeys: variables that move the file the client reads away from configPath.
const CLAUDE_CODE_TARGET: ClientTarget = {
  configPath: '.claude.json',
  format: 'json',
  serversKey: 'mcpServers',
  timeoutKeys: [],
  preservedKeys: [],
  configPathEnvKeys: ['CLAUDE_CONFIG_DIR'],
  timeoutNote: CLAUDE_CODE_TIMEOUT_NOTE,
};

const CODEX_TARGET: ClientTarget = {
  configPath: '.codex/config.toml',
  format: 'toml',
  serversKey: 'mcp_servers',
  timeoutKeys: [CODEX_TOOL_TIMEOUT_RULE, CODEX_STARTUP_TIMEOUT_RULE],
  preservedKeys: [],
  configPathEnvKeys: ['CODEX_HOME'],
};

const COPILOT_TARGET: ClientTarget = {
  configPath: '.copilot/mcp-config.json',
  format: 'json',
  serversKey: 'mcpServers',
  timeoutKeys: [TIMEOUT_MS_RULE],
  preservedKeys: ['tools'],
  configPathEnvKeys: ['COPILOT_HOME'],
};

const CURSOR_TARGET: ClientTarget = {
  configPath: '.cursor/mcp.json',
  format: 'json',
  serversKey: 'mcpServers',
  timeoutKeys: [],
  preservedKeys: [],
  configPathEnvKeys: [],
};

const GEMINI_TARGET: ClientTarget = {
  configPath: '.gemini/settings.json',
  format: 'json',
  serversKey: 'mcpServers',
  timeoutKeys: [TIMEOUT_MS_RULE],
  preservedKeys: [],
  configPathEnvKeys: [],
};

const OPENCODE_TARGET: ClientTarget = {
  configPath: '.config/opencode/opencode.json',
  format: 'json',
  serversKey: 'mcp',
  timeoutKeys: [TIMEOUT_MS_RULE],
  preservedKeys: ['enabled'],
  configPathEnvKeys: ['OPENCODE_CONFIG', 'XDG_CONFIG_HOME'],
};

const WINDSURF_TARGET: ClientTarget = {
  configPath: '.codeium/windsurf/mcp_config.json',
  format: 'json',
  serversKey: 'mcpServers',
  timeoutKeys: [],
  preservedKeys: [],
  configPathEnvKeys: [],
};

const GENERIC_TARGET: ClientTarget = {
  configPath: undefined,
  format: 'json',
  serversKey: 'mcpServers',
  timeoutKeys: [],
  preservedKeys: [],
  configPathEnvKeys: [],
};

export const CLIENT_TARGETS: ClientTargetMap = {
  'claude-code': CLAUDE_CODE_TARGET,
  codex: CODEX_TARGET,
  copilot: COPILOT_TARGET,
  cursor: CURSOR_TARGET,
  gemini: GEMINI_TARGET,
  opencode: OPENCODE_TARGET,
  windsurf: WINDSURF_TARGET,
  generic: GENERIC_TARGET,
};
