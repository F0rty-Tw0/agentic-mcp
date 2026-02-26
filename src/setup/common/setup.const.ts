import type { SupportedClient } from './setup.types';

export const KNOWN_PROVIDER_COMMANDS = ['claude', 'codex', 'copilot', 'gemini', 'opencode'] as const;

type ClientConfigPathMap = Readonly<Record<SupportedClient, string | undefined>>;

export const CLIENT_CONFIG_PATHS: ClientConfigPathMap = {
  'claude-code': '.claude/claude_desktop_config.json',
  cursor: '.cursor/mcp.json',
  windsurf: '.codeium/windsurf/mcp_config.json',
  generic: undefined,
};
