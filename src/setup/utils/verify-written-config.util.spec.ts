import { describe, expect, it } from 'vitest';

import { verifyWrittenConfig } from './verify-written-config.util';
import { CLIENT_TARGETS } from '../common';

describe('FEATURE: written config verification', () => {
  describe('GIVEN an OpenCode config', () => {
    it('WHEN the entry is under mcp THEN it is verified as written', () => {
      const result = verifyWrittenConfig('{"mcp":{"agentic-mcp":{"type":"local"}}}', CLIENT_TARGETS.opencode);

      expect(result.status).toBe('written');
    });

    it('WHEN the servers object lacks agentic-mcp THEN the reason names the key', () => {
      const result = verifyWrittenConfig('{"mcp":{}}', CLIENT_TARGETS.opencode);

      expect(result.reason).toBe('Written config must include mcp["agentic-mcp"].');
    });
  });

  describe('GIVEN a Codex config', () => {
    it('WHEN the agentic-mcp table is present THEN it is verified as written', () => {
      const result = verifyWrittenConfig('[mcp_servers.agentic-mcp]\ncommand = "npx"\n', CLIENT_TARGETS.codex);

      expect(result.status).toBe('written');
    });

    it('WHEN the text is not TOML THEN the reason says so', () => {
      const result = verifyWrittenConfig('[mcp_servers\n', CLIENT_TARGETS.codex);

      expect(result.reason).toMatch(/^Invalid TOML in written file: /);
    });
  });

  describe('GIVEN a JSON config whose root is not an object', () => {
    it('WHEN verifying THEN it fails on the root', () => {
      const result = verifyWrittenConfig('[]', CLIENT_TARGETS.gemini);

      expect(result.reason).toBe('Written config root must be an object.');
    });
  });
});
