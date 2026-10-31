import { describe, expect, it } from 'vitest';

import { mergeAgenticServerEntry } from './merge-server-entry.util';
import type { ClientTarget, McpServerEntry } from '../common';

const TIMED_TARGET: ClientTarget = {
  configPath: '.client.json',
  serversKey: 'mcpServers',
  timeoutKeys: ['timeout'],
  preservedKeys: ['tools'],
};

const TIMED_ENTRY: McpServerEntry = {
  command: 'npx',
  args: ['-y', 'agentic-mcp'],
  timeout: 3_660_000,
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
        notes: ['agentic-mcp timeout: set to 3660000 (was not set).'],
      });
    });
  });

  describe('GIVEN an existing entry with a lower timeout', () => {
    it('WHEN merging THEN the timeout is raised and the change is reported', () => {
      const existingEntry = { command: 'npx', args: ['-y', 'agentic-mcp'], timeout: 600_000 };

      const result = mergeAgenticServerEntry({ existingEntry, agenticServerEntry: TIMED_ENTRY, target: TIMED_TARGET });

      expect(result).toStrictEqual({
        entry: TIMED_ENTRY,
        notes: ['agentic-mcp timeout: raised from 600000 to 3660000.'],
      });
    });
  });

  describe('GIVEN an existing entry with a higher timeout', () => {
    it('WHEN merging THEN the user value is kept and reported', () => {
      const existingEntry = { command: 'npx', args: ['-y', 'agentic-mcp'], timeout: 7_200_000 };

      const result = mergeAgenticServerEntry({ existingEntry, agenticServerEntry: TIMED_ENTRY, target: TIMED_TARGET });

      expect(result).toStrictEqual({
        entry: existingEntry,
        notes: ['agentic-mcp timeout: kept your 7200000 (not lower than 3660000).'],
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
      const existingEntry = { command: 'node', args: ['old.js'], env, timeout: 3_660_000 };

      const result = mergeAgenticServerEntry({ existingEntry, agenticServerEntry: TIMED_ENTRY, target: TIMED_TARGET });

      expect(result.entry).toStrictEqual({ command: 'npx', args: ['-y', 'agentic-mcp'], env, timeout: 3_660_000 });
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
});
