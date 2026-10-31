import { describe, expect, it } from 'vitest';

import { buildKeptTimeoutNote } from './kept-timeout-note.util';

const TOOL_TIMEOUT_MS = 4_260_000;

const LOW_TIMEOUT_ENTRY = { timeout: 600_000 };

const MATCHING_TIMEOUT_ENTRY = { timeout: TOOL_TIMEOUT_MS };

const EMPTY_ENTRY = {};

describe('buildKeptTimeoutNote', () => {
  it('GIVEN a kept timeout lower than the tool-call timeout WHEN building the note THEN it warns that long runs are cut', () => {
    const note = buildKeptTimeoutNote({
      key: 'timeout',
      existingEntry: LOW_TIMEOUT_ENTRY,
      toolTimeoutMs: TOOL_TIMEOUT_MS,
    });

    expect(note).toBe(
      "agentic-mcp timeout: kept your 600000 ms, but it is lower than the 4260000 ms tool-call timeout, so it cuts long provider runs short; remove it to use Claude Code's default, or raise it to at least 4260000."
    );
  });

  it('GIVEN a kept timeout not lower than the tool-call timeout WHEN building the note THEN there is no note', () => {
    const note = buildKeptTimeoutNote({
      key: 'timeout',
      existingEntry: MATCHING_TIMEOUT_ENTRY,
      toolTimeoutMs: TOOL_TIMEOUT_MS,
    });

    expect(note).toBeUndefined();
  });

  it('GIVEN no timeout in the entry WHEN building the note THEN there is no note', () => {
    const note = buildKeptTimeoutNote({ key: 'timeout', existingEntry: EMPTY_ENTRY, toolTimeoutMs: TOOL_TIMEOUT_MS });

    expect(note).toBeUndefined();
  });

  it('GIVEN a target without a kept timeout key WHEN building the note THEN there is no note', () => {
    const note = buildKeptTimeoutNote({
      key: undefined,
      existingEntry: LOW_TIMEOUT_ENTRY,
      toolTimeoutMs: TOOL_TIMEOUT_MS,
    });

    expect(note).toBeUndefined();
  });

  it('GIVEN no derived tool-call timeout WHEN building the note THEN there is no note', () => {
    const note = buildKeptTimeoutNote({ key: 'timeout', existingEntry: LOW_TIMEOUT_ENTRY, toolTimeoutMs: undefined });

    expect(note).toBeUndefined();
  });
});
