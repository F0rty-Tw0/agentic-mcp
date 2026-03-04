import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runCli } from './cli.router';

vi.mock('../../ask', () => ({
  handleAsk: vi.fn(async () => Promise.resolve({ content: [{ type: 'text', text: 'ok' }] })),
}));

vi.mock('../../ask-all', () => ({
  handleAskAll: vi.fn(async () => Promise.resolve({ content: [{ type: 'text', text: 'ok' }] })),
}));

vi.mock('../../config/loader', () => ({
  warnDangerousFlags: vi.fn(),
  loadConfig: vi.fn(async () =>
    Promise.resolve({
      providers: {
        claude: {
          enabled: true,
          command: 'claude',
          description: 'test',
          timeout: 1000,
          env: {},
          outputFormat: 'text',
          commands: { ask: { args: ['-p'], trailingArgs: [], flags: {} } },
          input: { method: 'flag' },
        },
      },
    })
  ),
}));

vi.mock('../../provider-metrics', () => ({
  handleProviderMetrics: vi.fn(() => ({ content: [{ type: 'text', text: 'ok' }] })),
}));

vi.mock('../../shared', () => ({
  resolveCliBinary: vi.fn(async () => Promise.resolve('/usr/bin/claude')),
}));

vi.mock('../../simple-tools', () => ({
  handleHelp: vi.fn(async () => Promise.resolve({ content: [{ type: 'text', text: 'ok' }] })),
  handleListProviders: vi.fn(() => ({ content: [{ type: 'text', text: 'ok' }] })),
  handlePing: vi.fn(async () => Promise.resolve({ content: [{ type: 'text', text: 'ok' }] })),
}));

describe('runCli', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = undefined;
  });

  it('GIVEN ask_claude WHEN run THEN calls handleAsk with resolved provider and parsed args', async () => {
    const { handleAsk } = await import('../../ask');

    await runCli('ask_claude', ['hello']);

    expect(handleAsk).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'claude', binaryPath: '/usr/bin/claude' }),
      expect.objectContaining({ prompt: 'hello' })
    );
    expect(stdoutSpy).toHaveBeenCalledWith('ok\n');
  });

  it('GIVEN ask_all WHEN run THEN calls handleAskAll with resolved providers', async () => {
    const { handleAskAll } = await import('../../ask-all');

    await runCli('ask_all', ['hello']);

    expect(handleAskAll).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'claude' })]),
      expect.objectContaining({ prompt: 'hello' })
    );
    expect(stdoutSpy).toHaveBeenCalledWith('ok\n');
  });

  it('GIVEN ping_claude WHEN run THEN calls handlePing with resolved provider', async () => {
    const { handlePing } = await import('../../simple-tools');

    await runCli('ping_claude', []);

    expect(handlePing).toHaveBeenCalledWith(expect.objectContaining({ name: 'claude' }));
    expect(stdoutSpy).toHaveBeenCalledWith('ok\n');
  });

  it('GIVEN help_claude WHEN run THEN calls handleHelp with resolved provider', async () => {
    const { handleHelp } = await import('../../simple-tools');

    await runCli('help_claude', []);

    expect(handleHelp).toHaveBeenCalledWith(expect.objectContaining({ name: 'claude' }));
    expect(stdoutSpy).toHaveBeenCalledWith('ok\n');
  });

  it('GIVEN list_providers WHEN run THEN calls handleListProviders', async () => {
    const { handleListProviders } = await import('../../simple-tools');

    await runCli('list_providers', []);

    expect(handleListProviders).toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenCalledWith('ok\n');
  });

  it('GIVEN provider_metrics WHEN run THEN calls handleProviderMetrics', async () => {
    const { handleProviderMetrics } = await import('../../provider-metrics');

    await runCli('provider_metrics', []);

    expect(handleProviderMetrics).toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenCalledWith('ok\n');
  });

  it('GIVEN unknown_cmd WHEN run THEN writes error to stderr and sets exitCode to 1', async () => {
    await runCli('unknown_cmd', []);

    expect(stderrSpy).toHaveBeenCalledWith('Unknown command: unknown_cmd\n');
    expect(process.exitCode).toBe(1);
  });

  it('GIVEN ask_nonexistent WHEN run THEN writes provider not found error to stderr', async () => {
    await runCli('ask_nonexistent', ['hello']);

    expect(stderrSpy).toHaveBeenCalledWith('Provider not found or not available: nonexistent\n');
    expect(process.exitCode).toBe(1);
  });
});
