import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { entry } from './entry';
import type { ProveCliInput } from '../../prove/common';
import type { ConfigPathOptions } from '../../shared';

type MockServer = {
  readonly connect: (transport: unknown) => Promise<void>;
};

type ExitFn = (code?: string | number | null) => never;

type MockTransport = {
  readonly transport: string;
};

const mocks = vi.hoisted(() => {
  const transportInstance = {
    transport: 'stdio',
  };
  const connect = vi.fn<(transport: unknown) => Promise<void>>();
  const createServer = vi.fn<(options?: ConfigPathOptions) => Promise<MockServer>>();
  const runSetup = vi.fn<(args: string[]) => Promise<void>>();
  const runProve = vi.fn<(input: ProveCliInput) => Promise<void>>();
  const runCli = vi.fn<(subcommand: string, remainingArgs: string[], configPath?: string) => Promise<void>>();
  const isCliSubcommand = vi.fn<(arg: string) => boolean>();
  const stdioServerTransport = vi.fn();

  const result = {
    connect,
    createServer,
    isCliSubcommand,
    runCli,
    runProve,
    runSetup,
    stdioServerTransport,
    transportInstance,
  };

  return result;
});

vi.mock('../../server', () => {
  const result = {
    createServer: mocks.createServer,
  };

  return result;
});

vi.mock('../../cli', () => {
  const result = {
    isCliSubcommand: mocks.isCliSubcommand,
    runCli: mocks.runCli,
  };

  return result;
});

vi.mock('../../setup', () => {
  const result = {
    runSetup: mocks.runSetup,
  };

  return result;
});

vi.mock('../../prove', () => {
  const result = {
    runProve: mocks.runProve,
  };

  return result;
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  const result = {
    StdioServerTransport: mocks.stdioServerTransport,
  };

  return result;
});

const resetArgv = (): void => {
  process.argv = ['node', ''];
};

function createMockTransport(): MockTransport {
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
    mocks.runProve.mockReset();
    mocks.runProve.mockResolvedValue(undefined);

    mocks.stdioServerTransport.mockReset();
    mocks.stdioServerTransport.mockImplementation(createMockTransport);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GIVEN --version flag WHEN main() is called THEN it prints the version and exits with code 0', async () => {
    process.argv = ['node', '', '--version'];

    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as ExitFn);

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
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as ExitFn);

    await entry();

    await vi.waitFor(() => {
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('--config'));
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('--context'));
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('--job-id'));
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('--stream-live'));
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('sessions_<provider>'));
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('prove'));
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('init'));
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('--minimal'));
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

  it('GIVEN "init" as first arg WHEN main() is called THEN it calls runSetup with --minimal prepended and does not start the server', async () => {
    process.argv = ['node', '', 'init', '--client', 'cursor'];

    mocks.runSetup.mockResolvedValue(undefined);

    await entry();

    expect(mocks.runSetup).toHaveBeenCalledWith(['--minimal', '--client', 'cursor']);
    expect(mocks.createServer).not.toHaveBeenCalled();
  });

  it('GIVEN "prove" as first arg WHEN main() is called THEN it calls runProve with remaining args and does not start the server', async () => {
    process.argv = ['node', '', 'prove', 'codex', '--config', '/tmp/custom.json'];

    await entry();

    expect(mocks.runProve).toHaveBeenCalledWith({
      args: ['codex', '--config', '/tmp/custom.json'],
      configPath: '/tmp/custom.json',
    });
    expect(mocks.createServer).not.toHaveBeenCalled();
    expect(mocks.runCli).not.toHaveBeenCalled();
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
