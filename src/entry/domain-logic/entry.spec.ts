import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { entry } from './entry';
import type { ConfigPathOptions } from '../../shared';

type MockServer = Readonly<{
  connect: (transport: unknown) => Promise<void>;
}>;

const mocks = vi.hoisted(() => {
  const transportInstance = {
    transport: 'stdio',
  };
  const connect = vi.fn<(transport: unknown) => Promise<void>>();
  const createServer = vi.fn<(options?: ConfigPathOptions) => Promise<MockServer>>();
  const runSetup = vi.fn<(args: readonly string[]) => Promise<void>>();
  const runCli = vi.fn<(subcommand: string, remainingArgs: readonly string[], configPath?: string) => Promise<void>>();
  const isCliSubcommand = vi.fn<(arg: string) => boolean>();
  const stdioServerTransport = vi.fn();

  return {
    connect,
    createServer,
    isCliSubcommand,
    runCli,
    runSetup,
    stdioServerTransport,
    transportInstance,
  };
});

vi.mock('../../server', () => ({
  createServer: mocks.createServer,
}));

vi.mock('../../cli', () => ({
  isCliSubcommand: mocks.isCliSubcommand,
  runCli: mocks.runCli,
}));

vi.mock('../../setup', () => ({
  runSetup: mocks.runSetup,
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: mocks.stdioServerTransport,
}));

const resetArgv = (): void => {
  process.argv = ['node', ''];
};

function createMockTransport(): {
  transport: string;
} {
  return mocks.transportInstance;
}

describe('main', () => {
  beforeEach(() => {
    vi.resetModules();
    resetArgv();

    mocks.connect.mockReset();
    mocks.connect.mockResolvedValue(undefined);

    mocks.createServer.mockReset();
    mocks.createServer.mockResolvedValue({
      connect: mocks.connect,
    });

    mocks.isCliSubcommand.mockReset();
    mocks.isCliSubcommand.mockReturnValue(false);

    mocks.runCli.mockReset();
    mocks.runCli.mockResolvedValue(undefined);

    mocks.runSetup.mockReset();

    mocks.stdioServerTransport.mockReset();
    mocks.stdioServerTransport.mockImplementation(createMockTransport);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GIVEN --version flag WHEN main() is called THEN it prints the version and exits with code 0', async () => {
    process.argv = ['node', '', '--version'];

    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as typeof process.exit);

    await entry();

    await vi.waitFor(() => {
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('0.0.0-dev'));
    expect(mocks.createServer).not.toHaveBeenCalled();
  });

  it('GIVEN --help flag WHEN main() is called THEN it prints usage info and exits with code 0', async () => {
    process.argv = ['node', '', '--help'];

    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as typeof process.exit);

    await entry();

    await vi.waitFor(() => {
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('--config'));
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('--version'));
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('--help'));
    expect(mocks.createServer).not.toHaveBeenCalled();
  });

  it('GIVEN a --config argument WHEN main() is called THEN it passes configPath to createServer and connects via stdio transport', async () => {
    process.argv = ['node', '', '--config', '/tmp/providers.json'];

    await entry();

    await vi.waitFor(() => {
      expect(mocks.connect).toHaveBeenCalledTimes(1);
    });

    expect(mocks.createServer).toHaveBeenCalledWith({
      configPath: '/tmp/providers.json',
    });
    expect(mocks.stdioServerTransport).toHaveBeenCalledTimes(1);
    expect(mocks.connect).toHaveBeenCalledWith(mocks.transportInstance);
  });

  it('GIVEN createServer throws WHEN main() is called THEN it rejects with the error', async () => {
    mocks.createServer.mockRejectedValueOnce(new Error('boom'));

    await expect(entry()).rejects.toThrow('boom');
  });

  it('GIVEN "setup" as first arg WHEN main() is called THEN it calls runSetup with remaining args and does not start the server', async () => {
    process.argv = ['node', '', 'setup', '--client', 'claude'];

    mocks.runSetup.mockResolvedValue(undefined);

    await entry();

    expect(mocks.runSetup).toHaveBeenCalledWith(['--client', 'claude']);
    expect(mocks.createServer).not.toHaveBeenCalled();
  });

  describe('CLI subcommand routing', () => {
    it('GIVEN a recognized CLI subcommand WHEN main() is called THEN it calls runCli with subcommand and remaining args', async () => {
      process.argv = ['node', '', 'ask_claude', 'hello world'];

      mocks.isCliSubcommand.mockReturnValue(true);

      await entry();

      expect(mocks.runCli).toHaveBeenCalledWith('ask_claude', ['hello world'], undefined);
      expect(mocks.createServer).not.toHaveBeenCalled();
    });

    it('GIVEN a CLI subcommand with --config WHEN main() is called THEN it passes configPath to runCli', async () => {
      process.argv = ['node', '', 'ping_claude', '--config', '/tmp/custom.json'];

      mocks.isCliSubcommand.mockReturnValue(true);

      await entry();

      expect(mocks.runCli).toHaveBeenCalledWith('ping_claude', ['--config', '/tmp/custom.json'], '/tmp/custom.json');
      expect(mocks.createServer).not.toHaveBeenCalled();
    });

    it('GIVEN a CLI subcommand with no extra args WHEN main() is called THEN it calls runCli with empty remaining args', async () => {
      process.argv = ['node', '', 'list_providers'];

      mocks.isCliSubcommand.mockReturnValue(true);

      await entry();

      expect(mocks.runCli).toHaveBeenCalledWith('list_providers', [], undefined);
      expect(mocks.createServer).not.toHaveBeenCalled();
    });

    it('GIVEN an unrecognized first arg WHEN main() is called THEN it falls through to MCP server startup', async () => {
      process.argv = ['node', '', 'unknown_command'];

      mocks.isCliSubcommand.mockReturnValue(false);

      await entry();

      expect(mocks.runCli).not.toHaveBeenCalled();
      expect(mocks.createServer).toHaveBeenCalled();
      expect(mocks.connect).toHaveBeenCalled();
    });

    it('GIVEN no args WHEN main() is called THEN it starts the MCP server', async () => {
      process.argv = ['node', ''];

      await entry();

      expect(mocks.runCli).not.toHaveBeenCalled();
      expect(mocks.createServer).toHaveBeenCalled();
      expect(mocks.connect).toHaveBeenCalled();
    });
  });
});
