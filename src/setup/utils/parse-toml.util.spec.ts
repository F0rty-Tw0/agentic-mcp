import { describe, expect, it } from 'vitest';

import { parsesTo, tryParseToml } from './parse-toml.util';

describe('FEATURE: TOML parsing for the config merge', () => {
  describe('GIVEN valid TOML', () => {
    it('WHEN parsing THEN tables are plain objects that compare equal to built ones', () => {
      const result = tryParseToml('[mcp_servers.docs]\ncommand = "docs-mcp"\n');
      const docs = { command: 'docs-mcp' };
      const servers = { docs };
      const table = { mcp_servers: servers };

      expect(result).toStrictEqual({ table });
    });

    it('WHEN an integer is beyond 2^53 THEN it is kept as a BigInt', () => {
      const result = tryParseToml('big = 9223372036854775807\n');

      const table = { big: 9_223_372_036_854_775_807n };

      expect(result).toStrictEqual({ table });
    });
  });

  describe('GIVEN text that is not TOML', () => {
    it('WHEN parsing THEN the reason is the first line of the parser message', () => {
      const result = tryParseToml('[mcp_servers\n');

      const reason = 'reason' in result ? result.reason : '';

      expect(reason).toMatch(/^Invalid TOML: [^\n]+$/);
    });
  });

  describe('GIVEN a text and an expected root', () => {
    it('WHEN the text parses to that root THEN it matches', () => {
      const result = parsesTo('model = "gpt-6"\n', { model: 'gpt-6' });

      expect(result).toBe(true);
    });

    it('WHEN the text parses to another root THEN it does not match', () => {
      const result = parsesTo('model = "gpt-5"\n', { model: 'gpt-6' });

      expect(result).toBe(false);
    });

    it('WHEN the text is not TOML THEN it does not match', () => {
      const result = parsesTo('[model\n', { model: 'gpt-6' });

      expect(result).toBe(false);
    });
  });
});
