import type { ClientTarget, TimeoutKeyRule } from './client-target.type';
import type { SupportedClient } from './setup.type';
import { DEFAULT_PROVIDER_QUEUE_TIMEOUT_MS } from '../../shared/command-execution/common';
import { DEFAULT_MCP_TOOL_TIMEOUT_MS } from '../../shared/provider/common';

const CLIENT_TIMEOUT_MARGIN_MS = 60_000;

// A client must outwait a queued call plus one provider run, or it cancels the call and agentic-mcp stops the CLI.
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

const MS_PER_SECOND = 1000;

export const CLIENT_TOOL_TIMEOUT_SEC = CLIENT_TOOL_TIMEOUT_MS / MS_PER_SECOND;

// Codex waits 30 s for a server to start by default; a cold `npx -y agentic-mcp` can take longer.
export const CODEX_STARTUP_TIMEOUT_SEC = 60;

const TIMEOUT_MS_RULE: TimeoutKeyRule = { key: 'timeout' };

const CODEX_TOOL_TIMEOUT_RULE: TimeoutKeyRule = { key: 'tool_timeout_sec' };

// Codex also reads startup_timeout_ms, and startup_timeout_sec wins when both are set.
const CODEX_STARTUP_TIMEOUT_RULE: TimeoutKeyRule = { key: 'startup_timeout_sec', msAliasKey: 'startup_timeout_ms' };

const CLAUDE_CODE_TARGET: ClientTarget = {
  configPath: '.claude.json',
  format: 'json',
  serversKey: 'mcpServers',
  timeoutKeys: [TIMEOUT_MS_RULE],
  preservedKeys: [],
};

const CODEX_TARGET: ClientTarget = {
  configPath: '.codex/config.toml',
  format: 'toml',
  serversKey: 'mcp_servers',
  timeoutKeys: [CODEX_TOOL_TIMEOUT_RULE, CODEX_STARTUP_TIMEOUT_RULE],
  preservedKeys: [],
};

const COPILOT_TARGET: ClientTarget = {
  configPath: '.copilot/mcp-config.json',
  format: 'json',
  serversKey: 'mcpServers',
  timeoutKeys: [TIMEOUT_MS_RULE],
  preservedKeys: ['tools'],
};

const CURSOR_TARGET: ClientTarget = {
  configPath: '.cursor/mcp.json',
  format: 'json',
  serversKey: 'mcpServers',
  timeoutKeys: [],
  preservedKeys: [],
};

const GEMINI_TARGET: ClientTarget = {
  configPath: '.gemini/settings.json',
  format: 'json',
  serversKey: 'mcpServers',
  timeoutKeys: [TIMEOUT_MS_RULE],
  preservedKeys: [],
};

const OPENCODE_TARGET: ClientTarget = {
  configPath: '.config/opencode/opencode.json',
  format: 'json',
  serversKey: 'mcp',
  timeoutKeys: [TIMEOUT_MS_RULE],
  preservedKeys: ['enabled'],
};

const WINDSURF_TARGET: ClientTarget = {
  configPath: '.codeium/windsurf/mcp_config.json',
  format: 'json',
  serversKey: 'mcpServers',
  timeoutKeys: [],
  preservedKeys: [],
};

const GENERIC_TARGET: ClientTarget = {
  configPath: undefined,
  format: 'json',
  serversKey: 'mcpServers',
  timeoutKeys: [],
  preservedKeys: [],
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
