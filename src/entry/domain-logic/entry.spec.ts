import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConfigPathOptions } from '../../shared/common/index.ts';

type MockServer = Readonly<{
  connect: (transport: unknown) => Promise<void>;
}>;

const mocks = vi.hoisted(() => {
  const transportInstance = {
    transport: 'stdio',
  };
  const connect = vi.fn<(transport: unknown) => Promise<void>>();
  const createServer = vi.fn<(options?: ConfigPathOptions) => Promise<MockServer>>();
  const stdioServerTransport = vi.fn();

  return {
    connect,
    createServer,
    stdioServerTransport,
    transportInstance,
  };
});

vi.mock('../../server/create-server.ts', () => ({
  createServer: mocks.createServer,
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: mocks.stdioServerTransport,
}));

const importMain = async (): Promise<void> => {
  const mainPath = './main.ts';
  const mod = (await import(mainPath)) as { main: () => Promise<void> };

  await mod.main();
};

const resetArgv = (): void => {
  process.argv = ['node', 'index.ts'];
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

    mocks.stdioServerTransport.mockReset();
    mocks.stdioServerTransport.mockImplementation(createMockTransport);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GIVEN --version flag WHEN main() is called THEN it prints the version and exits with code 0', async () => {
    process.argv = ['node', 'index.ts', '--version'];

    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as typeof process.exit);

    await importMain();

    await vi.waitFor(() => {
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('0.0.0-dev'));
    expect(mocks.createServer).not.toHaveBeenCalled();
  });

  it('GIVEN --help flag WHEN main() is called THEN it prints usage info and exits with code 0', async () => {
    process.argv = ['node', 'index.ts', '--help'];

    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as typeof process.exit);

    await importMain();

    await vi.waitFor(() => {
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('--config'));
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('--version'));
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('--help'));
    expect(mocks.createServer).not.toHaveBeenCalled();
  });

  it('GIVEN a --config argument WHEN main() is called THEN it passes configPath to createServer and connects via stdio transport', async () => {
    process.argv = ['node', 'index.ts', '--config', '/tmp/providers.json'];

    await importMain();

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

    await expect(importMain()).rejects.toThrow('boom');
  });
});
