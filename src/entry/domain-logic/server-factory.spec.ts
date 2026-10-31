import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createServerFactory } from './server-factory';
import type { ConfigPathOptions } from '../../shared';

type MockServer = {
  readonly name: string;
};

const mocks = vi.hoisted(() => {
  const createServer = vi.fn<(options?: ConfigPathOptions) => Promise<MockServer>>();
  const result = { createServer };

  return result;
});

vi.mock('../../server', () => {
  const result = { createServer: mocks.createServer };

  return result;
});

const buildServer = (name: string): MockServer => {
  const server: MockServer = { name };

  return server;
};

describe('createServerFactory', () => {
  const startupServer = buildServer('startup');
  const freshServer = buildServer('fresh');
  const options: ConfigPathOptions = { configPath: '/tmp/providers.json' };

  beforeEach(() => {
    mocks.createServer.mockReset();
    mocks.createServer.mockResolvedValueOnce(startupServer);
    mocks.createServer.mockResolvedValueOnce(freshServer);
  });

  describe('GIVEN config options', () => {
    describe('WHEN the factory is created', () => {
      it('THEN it builds the startup server from those options before any connection opens', async () => {
        await createServerFactory(options);

        expect(mocks.createServer).toHaveBeenCalledExactlyOnceWith(options);
      });
    });

    describe('WHEN the first connection asks for a server', () => {
      it('THEN it hands out the startup server without building another', async () => {
        const serverFactory = await createServerFactory(options);
        const server = await serverFactory();

        expect(server).toBe(startupServer);
        expect(mocks.createServer).toHaveBeenCalledTimes(1);
      });
    });

    describe('WHEN a second instance is asked for', () => {
      it('THEN it builds a fresh server from the same options without repeating startup warnings', async () => {
        const serverFactory = await createServerFactory(options);
        const quietOptions: ConfigPathOptions = { ...options, warnDangerousFlags: false, warnNoProviders: false };

        await serverFactory();

        const server = await serverFactory();

        expect(server).toBe(freshServer);
        expect(mocks.createServer).toHaveBeenNthCalledWith(2, quietOptions);
      });
    });
  });

  describe('GIVEN createServer rejects', () => {
    describe('WHEN the factory is created', () => {
      it('THEN the startup error propagates', async () => {
        mocks.createServer.mockReset();
        mocks.createServer.mockRejectedValueOnce(new Error('bad config'));

        const factoryPromise = createServerFactory(options);

        await expect(factoryPromise).rejects.toThrow('bad config');
      });
    });
  });
});
