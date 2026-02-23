import type { SupportedClient } from './setup.types.ts';

export const KNOWN_PROVIDER_COMMANDS = ['claude', 'codex', 'copilot', 'gemini', 'opencode'] as const;

export const CLIENT_CONFIG_PATHS: Readonly<Record<SupportedClient, string | null>> = {
  'claude-code': '.claude/claude_desktop_config.json',
  'cursor': '.cursor/mcp.json',
  'windsurf': '.codeium/windsurf/mcp_config.json',
  'generic': null,
};
