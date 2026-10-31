import type { SupportedClient } from './setup.type';
import { DEFAULT_PROVIDER_QUEUE_TIMEOUT_MS } from '../../shared/command-execution/common';
import { DEFAULT_MCP_TOOL_TIMEOUT_MS } from '../../shared/provider/common';

export const CLIENT_TIMEOUT_MARGIN_MS = 60_000;

// A client must outwait a queued call plus one provider run, or it cancels the call and agentic-mcp stops the CLI.
// This is the value for the default limits; setup derives its value from the providers config when it can load it.
export const CLIENT_TOOL_TIMEOUT_MS =
  DEFAULT_PROVIDER_QUEUE_TIMEOUT_MS + DEFAULT_MCP_TOOL_TIMEOUT_MS + CLIENT_TIMEOUT_MARGIN_MS;

export const SUPPORTED_CLIENTS: SupportedClient[] = [
  'antigravity',
  'claude-code',
  'codex',
  'copilot',
  'cursor',
  'gemini',
  'opencode',
  'windsurf',
  'generic',
];

export const SKILL_CONSENT_REASON = 'rerun with --yes to install it';

export const KNOWN_PROVIDER_COMMANDS = ['claude', 'codex', 'copilot', 'gemini', 'agy', 'opencode'] as const;
