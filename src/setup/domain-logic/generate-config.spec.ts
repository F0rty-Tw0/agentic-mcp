import { describe, expect, it } from 'vitest';

import { generateClientConfigEntry } from './generate-config';
import type { DetectedProvider } from '../common';

const makeProvider = (
  name: string,
  available: boolean,
  binaryPath: string | undefined = undefined
): DetectedProvider => ({
  name,
  available,
  binaryPath,
});

describe('generateClientConfigEntry', () => {
  it('GIVEN any client and providers WHEN generating entry THEN returns deterministic agentic-mcp entry', () => {
    const result = generateClientConfigEntry('claude-code', []);

    expect(result).toStrictEqual({
      command: 'npx',
      args: ['-y', 'agentic-mcp'],
    });
  });

  it('GIVEN generic client and provider detection WHEN generating entry THEN output stays stable', () => {
    const providers = [makeProvider('claude', true, '/usr/bin/claude')];

    const result = generateClientConfigEntry('generic', providers);

    expect(result.command).toBe('npx');
    expect(result.args).toStrictEqual(['-y', 'agentic-mcp']);
  });

  it('GIVEN available providers and unavailable providers WHEN generating entry THEN does not leak binary paths', () => {
    const providers = [makeProvider('claude', true, '/usr/bin/claude'), makeProvider('codex', false)];

    const result = generateClientConfigEntry('windsurf', providers);

    expect(result.command).toBe('npx');
    expect(result.args).toStrictEqual(['-y', 'agentic-mcp']);
  });
});
