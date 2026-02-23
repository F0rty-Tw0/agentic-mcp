import { describe, expect, it } from 'vitest';

import { buildHelpToolDefinition, buildListProvidersDefinition, buildPingToolDefinition } from './tool.builder.ts';

describe('buildPingToolDefinition', () => {
  it('GIVEN a provider name WHEN building ping tool THEN name follows ping_{provider} pattern', () => {
    const result = buildPingToolDefinition('claude');

    expect(result.name).toBe('ping_claude');
  });

  it('GIVEN a provider name WHEN building ping tool THEN description includes provider name', () => {
    const result = buildPingToolDefinition('codex');

    expect(result.description).toContain('codex');
  });

  it('GIVEN any provider WHEN building ping tool THEN inputSchema is empty', () => {
    const result = buildPingToolDefinition('claude');

    expect(result.inputSchema).toStrictEqual({});
  });

  it('GIVEN any provider WHEN building ping tool THEN annotations mark it read-only and idempotent', () => {
    const result = buildPingToolDefinition('claude');

    expect(result.annotations).toStrictEqual({ readOnlyHint: true, idempotentHint: true });
  });
});

describe('buildHelpToolDefinition', () => {
  it('GIVEN a provider name WHEN building help tool THEN name follows help_{provider} pattern', () => {
    const result = buildHelpToolDefinition('gemini');

    expect(result.name).toBe('help_gemini');
  });

  it('GIVEN a provider name WHEN building help tool THEN description includes provider name', () => {
    const result = buildHelpToolDefinition('copilot');

    expect(result.description).toContain('copilot');
  });

  it('GIVEN any provider WHEN building help tool THEN inputSchema is empty', () => {
    const result = buildHelpToolDefinition('gemini');

    expect(result.inputSchema).toStrictEqual({});
  });

  it('GIVEN any provider WHEN building help tool THEN annotations mark it read-only and idempotent', () => {
    const result = buildHelpToolDefinition('gemini');

    expect(result.annotations).toStrictEqual({ readOnlyHint: true, idempotentHint: true });
  });
});

describe('buildListProvidersDefinition', () => {
  it('GIVEN no arguments WHEN building list_providers tool THEN name is list_providers', () => {
    const result = buildListProvidersDefinition();

    expect(result.name).toBe('list_providers');
  });

  it('GIVEN no arguments WHEN building list_providers tool THEN description mentions AI models', () => {
    const result = buildListProvidersDefinition();

    expect(result.description).toContain('AI models');
  });

  it('GIVEN no arguments WHEN building list_providers tool THEN inputSchema is empty', () => {
    const result = buildListProvidersDefinition();

    expect(result.inputSchema).toStrictEqual({});
  });

  it('GIVEN no arguments WHEN building list_providers tool THEN annotations mark it read-only and idempotent', () => {
    const result = buildListProvidersDefinition();

    expect(result.annotations).toStrictEqual({ readOnlyHint: true, idempotentHint: true });
  });
});
