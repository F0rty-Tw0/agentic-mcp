import { parse } from 'smol-toml';
import { describe, expect, it } from 'vitest';

import { buildMergedTomlClientConfig } from './merge-toml-client-config.util';
import { CLIENT_TARGETS } from '../common';
import type { ClientConfigMergeResult, CodexServerEntry } from '../common';

const CODEX_ENTRY: CodexServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
  tool_timeout_sec: 4260,
  startup_timeout_sec: 60,
};

const CODEX_TARGET = CLIENT_TARGETS.codex;

const AGENTIC_TABLE_LINES = [
  '[mcp_servers.agentic-mcp]',
  'command = "npx"',
  'args = [ "-y", "agentic-mcp" ]',
  'tool_timeout_sec = 4260',
  'startup_timeout_sec = 60',
  '',
];

const AGENTIC_TABLE = AGENTIC_TABLE_LINES.join('\n');

const USER_CONFIG_LINES = [
  '# my codex settings',
  'model = "gpt-6"',
  '',
  '[mcp_servers.docs]',
  'command = "docs-mcp"',
  '',
];

const USER_CONFIG = USER_CONFIG_LINES.join('\n');

const LOW_TIMEOUT_CONFIG_LINES = [
  '# keep me',
  '[mcp_servers.agentic-mcp]',
  'command = "npx"',
  'args = ["-y", "agentic-mcp"]',
  'tool_timeout_sec = 300',
  '',
];

const LOW_TIMEOUT_CONFIG = LOW_TIMEOUT_CONFIG_LINES.join('\n');

const mergeToml = (existingConfigText: string | undefined): ClientConfigMergeResult => {
  const result = buildMergedTomlClientConfig({
    existingConfigText,
    agenticServerEntry: CODEX_ENTRY,
    target: CODEX_TARGET,
  });

  return result;
};

describe('FEATURE: TOML client config merge', () => {
  describe('GIVEN no existing config', () => {
    it('WHEN merging THEN only the agentic-mcp table is written', () => {
      const result = mergeToml(undefined);

      expect(result.status).toBe('created');
      expect(result.configText).toBe(AGENTIC_TABLE);
      expect(result.rewritten).toBe(false);
    });

    it('WHEN the existing file is blank THEN it is treated as new', () => {
      const result = mergeToml('\n  \n');

      expect(result.status).toBe('created');
    });
  });

  describe('GIVEN a config with comments, settings and another server', () => {
    it('WHEN merging THEN the agentic-mcp table is appended and the original text is kept as is', () => {
      const result = mergeToml(USER_CONFIG);

      expect(result.status).toBe('merged');
      expect(result.configText).toBe(`${USER_CONFIG}\n${AGENTIC_TABLE}`);
      expect(result.rewritten).toBe(false);
    });

    it('WHEN the file has no trailing newline THEN the table still starts on its own line', () => {
      const result = mergeToml('model = "gpt-6"');

      expect(result.configText).toBe(`model = "gpt-6"\n\n${AGENTIC_TABLE}`);
    });
  });

  describe('GIVEN the agentic-mcp table already matches', () => {
    it('WHEN merging THEN the status is unchanged and the text is byte-for-byte the same', () => {
      const existingText = `# note\n${AGENTIC_TABLE}`;

      const result = mergeToml(existingText);

      expect(result.status).toBe('unchanged');
      expect(result.configText).toBe(existingText);
    });
  });

  describe('GIVEN an agentic-mcp table with a lower tool timeout', () => {
    it('WHEN merging THEN the file is rewritten with the raised timeout', () => {
      const result = mergeToml(LOW_TIMEOUT_CONFIG);
      const written = structuredClone(parse(result.configText));

      expect(result.status).toBe('merged');
      expect(result.rewritten).toBe(true);
      const expectedServers = { 'agentic-mcp': CODEX_ENTRY };

      expect(written).toStrictEqual({ mcp_servers: expectedServers });
      expect(result.notes).toStrictEqual([
        'agentic-mcp tool_timeout_sec: raised from 300 to 4260.',
        'agentic-mcp startup_timeout_sec: set to 60 (was not set).',
      ]);
    });
  });

  describe('GIVEN mcp_servers is an inline table', () => {
    it('WHEN merging THEN a table cannot be appended and the file is rewritten instead', () => {
      const result = mergeToml('mcp_servers = { docs = { command = "docs-mcp" } }\n');
      const written = structuredClone(parse(result.configText));
      const docs = { command: 'docs-mcp' };
      const expectedServers = { docs, 'agentic-mcp': CODEX_ENTRY };

      expect(result.rewritten).toBe(true);
      expect(written).toStrictEqual({ mcp_servers: expectedServers });
    });
  });

  describe('GIVEN a file that is not valid TOML', () => {
    it('WHEN merging THEN the status is invalid-toml with the parser message', () => {
      const result = mergeToml('[mcp_servers\ncommand = "x"\n');

      expect(result.status).toBe('invalid-toml');
      expect(result.reason).toMatch(/^Invalid TOML: /);
      expect(result.notes).toStrictEqual([]);
    });
  });

  describe('GIVEN a value a rewrite would change', () => {
    it('WHEN the agentic-mcp table must be updated THEN the merge is refused as rewrite-unsafe', () => {
      const result = mergeToml(`zero = -0.0\n${LOW_TIMEOUT_CONFIG}`);

      expect(result.status).toBe('rewrite-unsafe');
      expect(result.reason).toContain('would change other values');
    });
  });

  describe('GIVEN a very large integer elsewhere in the file', () => {
    it('WHEN the file is rewritten THEN the integer keeps every digit', () => {
      const result = mergeToml(`big = 9223372036854775807\n${LOW_TIMEOUT_CONFIG}`);

      expect(result.configText).toContain('big = 9223372036854775807');
    });
  });
});
