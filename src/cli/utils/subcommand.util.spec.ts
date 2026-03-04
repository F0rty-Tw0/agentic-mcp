import { describe, expect, it } from 'vitest';

import { isCliSubcommand, parseSubcommand } from './subcommand.util';

describe('parseSubcommand', () => {
  describe('ask commands', () => {
    it('GIVEN ask_claude WHEN parsed THEN returns ask type with providerName claude', () => {
      const result = parseSubcommand('ask_claude');

      expect(result).toStrictEqual({ type: 'ask', providerName: 'claude' });
    });

    it('GIVEN ask_codex WHEN parsed THEN returns ask type with providerName codex', () => {
      const result = parseSubcommand('ask_codex');

      expect(result).toStrictEqual({ type: 'ask', providerName: 'codex' });
    });

    it('GIVEN ask_all WHEN parsed THEN returns ask_all type (NOT ask with provider "all")', () => {
      const result = parseSubcommand('ask_all');

      expect(result).toStrictEqual({ type: 'ask_all' });
    });

    it('GIVEN ask_ with empty provider WHEN parsed THEN returns undefined', () => {
      const result = parseSubcommand('ask_');

      expect(result).toBeUndefined();
    });
  });

  describe('ping commands', () => {
    it('GIVEN ping_gemini WHEN parsed THEN returns ping type with providerName gemini', () => {
      const result = parseSubcommand('ping_gemini');

      expect(result).toStrictEqual({ type: 'ping', providerName: 'gemini' });
    });

    it('GIVEN ping_ with empty provider WHEN parsed THEN returns undefined', () => {
      const result = parseSubcommand('ping_');

      expect(result).toBeUndefined();
    });
  });

  describe('help commands', () => {
    it('GIVEN help_copilot WHEN parsed THEN returns help type with providerName copilot', () => {
      const result = parseSubcommand('help_copilot');

      expect(result).toStrictEqual({ type: 'help', providerName: 'copilot' });
    });
  });

  describe('global commands', () => {
    it('GIVEN list_providers WHEN parsed THEN returns list_providers type', () => {
      const result = parseSubcommand('list_providers');

      expect(result).toStrictEqual({ type: 'list_providers' });
    });

    it('GIVEN provider_metrics WHEN parsed THEN returns provider_metrics type', () => {
      const result = parseSubcommand('provider_metrics');

      expect(result).toStrictEqual({ type: 'provider_metrics' });
    });
  });

  describe('unknown commands', () => {
    it('GIVEN unknown string WHEN parsed THEN returns undefined', () => {
      const result = parseSubcommand('unknown');

      expect(result).toBeUndefined();
    });
  });
});

describe('isCliSubcommand', () => {
  it('GIVEN ask_claude WHEN checked THEN returns true', () => {
    const result = isCliSubcommand('ask_claude');

    expect(result).toBe(true);
  });

  it('GIVEN unknown WHEN checked THEN returns false', () => {
    const result = isCliSubcommand('unknown');

    expect(result).toBe(false);
  });

  it('GIVEN setup WHEN checked THEN returns false', () => {
    const result = isCliSubcommand('setup');

    expect(result).toBe(false);
  });

  it('GIVEN --version WHEN checked THEN returns false', () => {
    const result = isCliSubcommand('--version');

    expect(result).toBe(false);
  });
});
