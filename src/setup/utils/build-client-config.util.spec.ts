import { describe, expect, it } from 'vitest';

import { buildClientConfig } from './build-client-config.util';
import { CLIENT_TARGETS } from '../common';
import type { CodexServerEntry, StdioServerEntry } from '../common';

const GEMINI_ENTRY: StdioServerEntry = { command: 'npx', args: ['-y', 'agentic-mcp'], timeout: 4_260_000 };

const CODEX_ENTRY: CodexServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
  tool_timeout_sec: 4260,
  startup_timeout_sec: 60,
};

describe('FEATURE: client config text', () => {
  describe('GIVEN a JSON client target', () => {
    it('WHEN building the config THEN the text is pretty-printed JSON with a trailing newline', () => {
      const result = buildClientConfig({
        existingConfigText: undefined,
        agenticServerEntry: GEMINI_ENTRY,
        target: CLIENT_TARGETS.gemini,
      });
      const servers = { 'agentic-mcp': GEMINI_ENTRY };
      const expectedText = `${JSON.stringify({ mcpServers: servers }, null, 2)}\n`;

      expect(result.configText).toBe(expectedText);
      expect(result.rewritten).toBe(false);
    });
  });

  describe('GIVEN a TOML client target', () => {
    it('WHEN building the config THEN the text is a TOML table', () => {
      const result = buildClientConfig({
        existingConfigText: undefined,
        agenticServerEntry: CODEX_ENTRY,
        target: CLIENT_TARGETS.codex,
      });

      expect(result.configText).toMatch(/^\[mcp_servers\.agentic-mcp\]\n/);
    });
  });
});
