import { describe, expect, it } from 'vitest';

import { mergeAgenticServerEntry } from './merge-server-entry.util';
import type { ClientTarget, McpServerEntry, TimeoutKeyRule } from '../common';

const TIMEOUT_RULE: TimeoutKeyRule = { key: 'timeout' };

const STARTUP_RULE: TimeoutKeyRule = { key: 'startup_timeout_sec', msAliasKey: 'startup_timeout_ms' };

const TIMED_TARGET: ClientTarget = {
  configPath: '.client.json',
  format: 'json',
  serversKey: 'mcpServers',
  timeoutKeys: [TIMEOUT_RULE],
  preservedKeys: ['tools'],
};

const CODEX_LIKE_TARGET: ClientTarget = {
  configPath: '.codex/config.toml',
  format: 'toml',
  serversKey: 'mcp_servers',
  timeoutKeys: [STARTUP_RULE],
  preservedKeys: [],
};

const CODEX_LIKE_ENTRY: McpServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
  tool_timeout_sec: 4260,
  startup_timeout_sec: 60,
};

const TIMED_ENTRY: McpServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
  timeout: 4_260_000,
};

describe('FEATURE: agentic-mcp server entry merge', () => {
  describe('GIVEN no existing agentic-mcp entry', () => {
    it('WHEN merging THEN the generated entry is used and the timeout is reported as set', () => {
      const result = mergeAgenticServerEntry({
        existingEntry: undefined,
        agenticServerEntry: TIMED_ENTRY,
        target: TIMED_TARGET,
      });

      expect(result).toStrictEqual({
        entry: TIMED_ENTRY,
        notes: ['agentic-mcp timeout: set to 4260000 (was not set).'],
      });
    });
  });

  describe('GIVEN an existing entry with a lower timeout', () => {
    it('WHEN merging THEN the timeout is raised and the change is reported', () => {
      const existingEntry = { command: 'npx', args: ['-y', 'agentic-mcp'], timeout: 600_000 };

      const result = mergeAgenticServerEntry({ existingEntry, agenticServerEntry: TIMED_ENTRY, target: TIMED_TARGET });

      expect(result).toStrictEqual({
        entry: TIMED_ENTRY,
        notes: ['agentic-mcp timeout: raised from 600000 to 4260000.'],
      });
    });
  });

  describe('GIVEN an existing entry with a higher timeout', () => {
    it('WHEN merging THEN the user value is kept and reported', () => {
      const existingEntry = { command: 'npx', args: ['-y', 'agentic-mcp'], timeout: 7_200_000 };

      const result = mergeAgenticServerEntry({ existingEntry, agenticServerEntry: TIMED_ENTRY, target: TIMED_TARGET });

      expect(result).toStrictEqual({
        entry: existingEntry,
        notes: ['agentic-mcp timeout: kept your 7200000 (not lower than 4260000).'],
      });
    });
  });

  describe('GIVEN an existing entry with a timeout too large for a number (TOML BigInt)', () => {
    it('WHEN merging THEN the user value is kept and reported', () => {
      const existingEntry = { command: 'npx', args: ['-y', 'agentic-mcp'], timeout: 99_999_999_999_999_999_999n };

      const result = mergeAgenticServerEntry({ existingEntry, agenticServerEntry: TIMED_ENTRY, target: TIMED_TARGET });

      expect(result).toStrictEqual({
        entry: existingEntry,
        notes: ['agentic-mcp timeout: kept your 99999999999999999999 (not lower than 4260000).'],
      });
    });
  });

  describe('GIVEN an existing entry with a timeout that is not a number', () => {
    it('WHEN merging THEN the generated timeout replaces it', () => {
      const existingEntry = { command: 'npx', args: ['-y', 'agentic-mcp'], timeout: '600000' };

      const result = mergeAgenticServerEntry({ existingEntry, agenticServerEntry: TIMED_ENTRY, target: TIMED_TARGET });

      expect(result.entry).toStrictEqual(TIMED_ENTRY);
    });
  });

  describe('GIVEN an existing entry with keys setup does not write', () => {
    it('WHEN merging THEN those keys are kept and the command is updated', () => {
      const env = { DEBUG: '1' };
      const existingEntry = { command: 'node', args: ['old.js'], env, timeout: 4_260_000 };

      const result = mergeAgenticServerEntry({ existingEntry, agenticServerEntry: TIMED_ENTRY, target: TIMED_TARGET });

      expect(result.entry).toStrictEqual({ command: 'npx', args: ['-y', 'agentic-mcp'], env, timeout: 4_260_000 });
    });

    it('WHEN a preserved key is set THEN the user value wins over the generated one', () => {
      const generatedEntry = { ...TIMED_ENTRY, tools: ['*'] };
      const existingEntry = { ...TIMED_ENTRY, tools: ['ask_codex'] };

      const result = mergeAgenticServerEntry({
        existingEntry,
        agenticServerEntry: generatedEntry,
        target: TIMED_TARGET,
      });

      expect(result.entry).toStrictEqual(existingEntry);
    });
  });

  describe('GIVEN a client target without a timeout key', () => {
    it('WHEN merging THEN no timeout note is produced', () => {
      const target: ClientTarget = { ...TIMED_TARGET, timeoutKeys: [] };
      const entry: McpServerEntry = { command: 'npx', args: ['-y', 'agentic-mcp'] };

      const result = mergeAgenticServerEntry({ existingEntry: undefined, agenticServerEntry: entry, target });

      expect(result).toStrictEqual({ entry, notes: [] });
    });
  });

  describe('GIVEN an existing entry that is not an object', () => {
    it('WHEN merging THEN it is replaced by the generated entry', () => {
      const result = mergeAgenticServerEntry({
        existingEntry: 'broken',
        agenticServerEntry: TIMED_ENTRY,
        target: TIMED_TARGET,
      });

      expect(result.entry).toStrictEqual(TIMED_ENTRY);
    });
  });

  describe('GIVEN a seconds timeout key whose ms alias is already as long', () => {
    it('WHEN merging THEN the seconds key is not added and the alias is kept', () => {
      const existingEntry = {
        command: 'npx',
        args: ['-y', 'agentic-mcp'],
        tool_timeout_sec: 4260,
        startup_timeout_ms: 120_000,
      };

      const result = mergeAgenticServerEntry({
        existingEntry,
        agenticServerEntry: CODEX_LIKE_ENTRY,
        target: CODEX_LIKE_TARGET,
      });

      expect(result).toStrictEqual({
        entry: existingEntry,
        notes: ['agentic-mcp startup_timeout_sec: not set; kept your startup_timeout_ms 120000 (not lower than 60 s).'],
      });
    });
  });

  describe('GIVEN a seconds timeout key whose ms alias is a TOML BigInt', () => {
    it('WHEN merging THEN the seconds key is not added and the alias is kept', () => {
      const existingEntry = {
        command: 'npx',
        args: ['-y', 'agentic-mcp'],
        startup_timeout_ms: 99_999_999_999_999_999_999n,
      };

      const result = mergeAgenticServerEntry({
        existingEntry,
        agenticServerEntry: CODEX_LIKE_ENTRY,
        target: CODEX_LIKE_TARGET,
      });

      expect(result.notes).toStrictEqual([
        'agentic-mcp startup_timeout_sec: not set; kept your startup_timeout_ms 99999999999999999999 (not lower than 60 s).',
      ]);
    });
  });

  describe('GIVEN a seconds timeout key whose ms alias is lower', () => {
    it('WHEN merging THEN the seconds key is added, since it wins over the alias', () => {
      const existingEntry = { command: 'npx', args: ['-y', 'agentic-mcp'], startup_timeout_ms: 10_000 };

      const result = mergeAgenticServerEntry({
        existingEntry,
        agenticServerEntry: CODEX_LIKE_ENTRY,
        target: CODEX_LIKE_TARGET,
      });

      const expectedEntry = { ...CODEX_LIKE_ENTRY, startup_timeout_ms: 10_000 };

      expect(result).toStrictEqual({
        entry: expectedEntry,
        notes: ['agentic-mcp startup_timeout_sec: set to 60 (your startup_timeout_ms 10000 was lower).'],
      });
    });
  });

  describe('GIVEN a seconds timeout key with a non-numeric ms alias', () => {
    it('WHEN merging THEN the seconds key is set as if no alias were there', () => {
      const existingEntry = { command: 'npx', args: ['-y', 'agentic-mcp'], startup_timeout_ms: 'slow' };

      const result = mergeAgenticServerEntry({
        existingEntry,
        agenticServerEntry: CODEX_LIKE_ENTRY,
        target: CODEX_LIKE_TARGET,
      });

      expect(result.notes).toStrictEqual(['agentic-mcp startup_timeout_sec: set to 60 (was not set).']);
    });
  });
});
