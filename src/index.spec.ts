import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockServer = Readonly<{
  connect: (transport: unknown) => Promise<void>;
}>;

const mocks = vi.hoisted(() => {
  const transportInstance = {
    transport: 'stdio',
  };
  const connect = vi.fn<(transport: unknown) => Promise<void>>();
  const createServer = vi.fn<(options?: { configPath?: string }) => Promise<MockServer>>();
  const stdioServerTransport = vi.fn();

  return {
    connect,
    createServer,
    stdioServerTransport,
    transportInstance,
  };
});

vi.mock('./server.ts', () => ({
  createServer: mocks.createServer,
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: mocks.stdioServerTransport,
}));

const importEntrypoint = async (): Promise<void> => {
  const entrypointPath = './index.ts';

  await import(entrypointPath);
};

const resetArgv = (): void => {
  process.argv = ['node', 'index.ts'];
};

function createMockTransport(): {
  transport: string;
} {
  return mocks.transportInstance;
}

describe('index entrypoint', () => {
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

  it('GIVEN a --config argument WHEN the entrypoint starts THEN it passes configPath to createServer and connects via stdio transport', async () => {
    process.argv = ['node', 'index.ts', '--config', '/tmp/providers.json'];

    await importEntrypoint();

    await vi.waitFor(() => {
      expect(mocks.connect).toHaveBeenCalledTimes(1);
    });

    expect(mocks.createServer).toHaveBeenCalledWith({
      configPath: '/tmp/providers.json',
    });
    expect(mocks.stdioServerTransport).toHaveBeenCalledTimes(1);
    expect(mocks.connect).toHaveBeenCalledWith(mocks.transportInstance);
  });

  it('GIVEN startup throws an error WHEN the entrypoint catches it THEN it writes a prefixed stderr message and exits with code 1', async () => {
    mocks.createServer.mockRejectedValueOnce(new Error('boom'));

    const stderrWriteSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as typeof process.exit);

    await importEntrypoint();

    await vi.waitFor(() => {
      expect(stderrWriteSpy).toHaveBeenCalledWith('agentic-mcp: boom\n');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    expect(exitSpy).toHaveBeenCalledTimes(1);
  });
});
