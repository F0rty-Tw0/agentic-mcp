import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildMergedClientConfig } from './merge-client-config.util';

describe('buildMergedClientConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('GIVEN no existing config WHEN merging THEN returns created status with agentic entry only', () => {
    const result = buildMergedClientConfig({
      existingConfigText: undefined,
      agenticServerEntry: {
        command: 'npx',
        args: ['-y', 'agentic-mcp'],
      },
    });

    expect(result.status).toBe('created');
    expect(result.mergedConfig).toStrictEqual({
      mcpServers: {
        'agentic-mcp': {
          command: 'npx',
          args: ['-y', 'agentic-mcp'],
        },
      },
    });
  });

  it('GIVEN valid existing config WHEN merging THEN returns merged status and preserves unrelated keys', () => {
    const result = buildMergedClientConfig({
      existingConfigText: JSON.stringify(
        {
          version: 1,
          mcpServers: {
            existing: {
              command: 'node',
              args: ['server.js'],
            },
          },
        },
        null,
        2
      ),
      agenticServerEntry: {
        command: 'npx',
        args: ['-y', 'agentic-mcp'],
      },
    });

    expect(result.status).toBe('merged');
    expect(result.mergedConfig).toStrictEqual({
      version: 1,
      mcpServers: {
        existing: {
          command: 'node',
          args: ['server.js'],
        },
        'agentic-mcp': {
          command: 'npx',
          args: ['-y', 'agentic-mcp'],
        },
      },
    });
  });

  it('GIVEN matching agentic entry WHEN merging THEN returns unchanged status', () => {
    const result = buildMergedClientConfig({
      existingConfigText: JSON.stringify({
        mcpServers: {
          'agentic-mcp': {
            command: 'npx',
            args: ['-y', 'agentic-mcp'],
          },
        },
      }),
      agenticServerEntry: {
        command: 'npx',
        args: ['-y', 'agentic-mcp'],
      },
    });

    expect(result.status).toBe('unchanged');
    expect(result.mergedConfig).toStrictEqual({
      mcpServers: {
        'agentic-mcp': {
          command: 'npx',
          args: ['-y', 'agentic-mcp'],
        },
      },
    });
  });

  it('GIVEN invalid JSON WHEN merging THEN returns invalid-json status', () => {
    const result = buildMergedClientConfig({
      existingConfigText: '{ bad json',
      agenticServerEntry: {
        command: 'npx',
        args: ['-y', 'agentic-mcp'],
      },
    });

    expect(result.status).toBe('invalid-json');
    expect(result.reason).toContain('Invalid JSON');
  });

  it('GIVEN existing root keys and servers WHEN merging THEN preserves unrelated entries', () => {
    const result = buildMergedClientConfig({
      existingConfigText: JSON.stringify({
        $schema: 'https://example.com/schema.json',
        metadata: {
          owner: 'team',
        },
        mcpServers: {
          alpha: {
            command: 'python',
            args: ['-m', 'alpha_server'],
          },
          beta: {
            command: 'node',
            args: ['beta.js'],
          },
        },
      }),
      agenticServerEntry: {
        command: 'npx',
        args: ['-y', 'agentic-mcp'],
      },
    });

    expect(result.status).toBe('merged');
    expect(result.mergedConfig).toStrictEqual({
      $schema: 'https://example.com/schema.json',
      metadata: {
        owner: 'team',
      },
      mcpServers: {
        alpha: {
          command: 'python',
          args: ['-m', 'alpha_server'],
        },
        beta: {
          command: 'node',
          args: ['beta.js'],
        },
        'agentic-mcp': {
          command: 'npx',
          args: ['-y', 'agentic-mcp'],
        },
      },
    });
  });
  it('GIVEN existing mcpServers is not an object WHEN merging THEN replaces it with the agentic server entry', () => {
    const result = buildMergedClientConfig({
      existingConfigText: JSON.stringify({
        version: 1,
        mcpServers: ['invalid-shape'],
      }),
      agenticServerEntry: {
        command: 'npx',
        args: ['-y', 'agentic-mcp'],
      },
    });

    expect(result.status).toBe('merged');
    expect(result.mergedConfig).toStrictEqual({
      version: 1,
      mcpServers: {
        'agentic-mcp': {
          command: 'npx',
          args: ['-y', 'agentic-mcp'],
        },
      },
    });
  });

  it('GIVEN parsed JSON is not an object WHEN merging THEN creates a config with only the agentic server entry', () => {
    const result = buildMergedClientConfig({
      existingConfigText: JSON.stringify(['not-an-object']),
      agenticServerEntry: {
        command: 'npx',
        args: ['-y', 'agentic-mcp'],
      },
    });

    expect(result.status).toBe('merged');
    expect(result.mergedConfig).toStrictEqual({
      mcpServers: {
        'agentic-mcp': {
          command: 'npx',
          args: ['-y', 'agentic-mcp'],
        },
      },
    });
  });

  it('GIVEN JSON parse throws a non-Error value WHEN merging THEN returns invalid-json with the fallback reason', () => {
    vi.spyOn(JSON, 'parse').mockImplementation(() => {
      const nonError = 'bad parse' as unknown as Error;

      throw nonError;
    });

    const result = buildMergedClientConfig({
      existingConfigText: '{ still bad json',
      agenticServerEntry: {
        command: 'npx',
        args: ['-y', 'agentic-mcp'],
      },
    });

    expect(result.status).toBe('invalid-json');
    expect(result.reason).toBe('Invalid JSON');
  });
});
