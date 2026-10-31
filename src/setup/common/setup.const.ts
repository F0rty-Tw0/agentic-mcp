import type { ClientTarget, SupportedClient } from './setup.type';
import { DEFAULT_MCP_TOOL_TIMEOUT_MS } from '../../shared/provider/common';

const CLIENT_TIMEOUT_MARGIN_MS = 60_000;

// A client must wait longer than one provider run, or it cancels the call and agentic-mcp stops the CLI.
export const CLIENT_TOOL_TIMEOUT_MS = DEFAULT_MCP_TOOL_TIMEOUT_MS + CLIENT_TIMEOUT_MARGIN_MS;

export const SUPPORTED_CLIENTS: SupportedClient[] = [
  'claude-code',
  'copilot',
  'cursor',
  'gemini',
  'windsurf',
  'generic',
];

export const KNOWN_PROVIDER_COMMANDS = ['claude', 'codex', 'copilot', 'gemini', 'agy', 'opencode'] as const;

type ClientTargetMap = Readonly<Record<SupportedClient, ClientTarget>>;

const CLAUDE_CODE_TARGET: ClientTarget = {
  configPath: '.claude.json',
  serversKey: 'mcpServers',
  timeoutKeys: ['timeout'],
  preservedKeys: [],
};

const COPILOT_TARGET: ClientTarget = {
  configPath: '.copilot/mcp-config.json',
  serversKey: 'mcpServers',
  timeoutKeys: ['timeout'],
  preservedKeys: ['tools'],
};

const CURSOR_TARGET: ClientTarget = {
  configPath: '.cursor/mcp.json',
  serversKey: 'mcpServers',
  timeoutKeys: [],
  preservedKeys: [],
};

const GEMINI_TARGET: ClientTarget = {
  configPath: '.gemini/settings.json',
  serversKey: 'mcpServers',
  timeoutKeys: ['timeout'],
  preservedKeys: [],
};

const WINDSURF_TARGET: ClientTarget = {
  configPath: '.codeium/windsurf/mcp_config.json',
  serversKey: 'mcpServers',
  timeoutKeys: [],
  preservedKeys: [],
};

const GENERIC_TARGET: ClientTarget = {
  configPath: undefined,
  serversKey: 'mcpServers',
  timeoutKeys: [],
  preservedKeys: [],
};

export const CLIENT_TARGETS: ClientTargetMap = {
  'claude-code': CLAUDE_CODE_TARGET,
  copilot: COPILOT_TARGET,
  cursor: CURSOR_TARGET,
  gemini: GEMINI_TARGET,
  windsurf: WINDSURF_TARGET,
  generic: GENERIC_TARGET,
};
