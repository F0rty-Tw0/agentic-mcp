import { describe, expect, it } from 'vitest';

import { isCliSubcommand, parseSubcommand } from './subcommand.util';
import type { CliSubcommand } from '../common';

describe('parseSubcommand', () => {
  it('GIVEN ask_claude WHEN parsed THEN it returns the exact tool name', () => {
    const result = parseSubcommand('ask_claude');

    expect(result).toBe('ask_claude');
  });

  it('GIVEN ask_all WHEN parsed THEN it returns the exact tool name', () => {
    const result = parseSubcommand('ask_all');

    expect(result).toBe('ask_all');
  });

  it('GIVEN ping_gemini WHEN parsed THEN it returns the exact tool name', () => {
    const result = parseSubcommand('ping_gemini');

    expect(result).toBe('ping_gemini');
  });

  it('GIVEN help_copilot WHEN parsed THEN it returns the exact tool name', () => {
    const result = parseSubcommand('help_copilot');

    expect(result).toBe('help_copilot');
  });

  it('GIVEN sessions_claude WHEN parsed THEN it returns the exact tool name', () => {
    const result = parseSubcommand('sessions_claude');

    expect(result).toBe('sessions_claude');
  });

  it('GIVEN list_providers WHEN parsed THEN it returns the exact tool name', () => {
    const result = parseSubcommand('list_providers');

    expect(result).toBe('list_providers');
  });

  it('GIVEN provider_metrics WHEN parsed THEN it returns the exact tool name', () => {
    const result = parseSubcommand('provider_metrics');

    expect(result).toBe('provider_metrics');
  });

  it('GIVEN ask_ with an empty provider WHEN parsed THEN it returns undefined', () => {
    const result = parseSubcommand('ask_');

    expect(result).toBeUndefined();
  });

  it('GIVEN ping_ with an empty provider WHEN parsed THEN it returns undefined', () => {
    const result = parseSubcommand('ping_');

    expect(result).toBeUndefined();
  });

  it('GIVEN help_ with an empty provider WHEN parsed THEN it returns undefined', () => {
    const result = parseSubcommand('help_');

    expect(result).toBeUndefined();
  });

  it('GIVEN sessions_ with an empty provider WHEN parsed THEN it returns undefined', () => {
    const result = parseSubcommand('sessions_');

    expect(result).toBeUndefined();
  });

  it('GIVEN an unknown string WHEN parsed THEN it returns undefined', () => {
    const result = parseSubcommand('unknown' as CliSubcommand);

    expect(result).toBeUndefined();
  });
});

describe('isCliSubcommand', () => {
  it('GIVEN ask_claude WHEN checked THEN it returns true', () => {
    const result = isCliSubcommand('ask_claude');

    expect(result).toBe(true);
  });

  it('GIVEN sessions_claude WHEN checked THEN it returns true', () => {
    const result = isCliSubcommand('sessions_claude');

    expect(result).toBe(true);
  });

  it('GIVEN unknown WHEN checked THEN it returns false', () => {
    const result = isCliSubcommand('unknown' as CliSubcommand);

    expect(result).toBe(false);
  });

  it('GIVEN setup WHEN checked THEN it returns false', () => {
    const result = isCliSubcommand('setup' as CliSubcommand);

    expect(result).toBe(false);
  });

  it('GIVEN --version WHEN checked THEN it returns false', () => {
    const result = isCliSubcommand('--version' as CliSubcommand);

    expect(result).toBe(false);
  });
});
