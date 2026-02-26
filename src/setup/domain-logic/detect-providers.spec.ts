import { beforeEach, describe, expect, it, vi } from 'vitest';

import { detectInstalledProviders } from './detect-providers';

const mocks = vi.hoisted(() => ({
  resolveCliBinary: vi.fn<(command: string) => Promise<string | undefined>>(),
}));

vi.mock('../../shared/utils/', () => ({
  resolveCliBinary: mocks.resolveCliBinary,
}));

const resolveOnlyClaudeBinary = async (cmd: string): Promise<string | undefined> => {
  const binaryPath = await Promise.resolve(cmd === 'claude' ? '/usr/bin/claude' : undefined);

  return binaryPath;
};

describe('detectInstalledProviders', () => {
  beforeEach(() => {
    mocks.resolveCliBinary.mockReset();
  });

  describe('all providers available', () => {
    it('GIVEN all provider binaries exist WHEN detecting THEN returns all providers as available', async () => {
      mocks.resolveCliBinary.mockImplementation(async (cmd) => Promise.resolve(`/usr/bin/${cmd}`));

      const result = await detectInstalledProviders();

      expect(result).toHaveLength(5);

      for (const provider of result) {
        expect(provider.available).toBe(true);
        expect(provider.binaryPath).toBe(`/usr/bin/${provider.name}`);
      }
    });
  });

  describe('no providers available', () => {
    it('GIVEN no provider binaries exist WHEN detecting THEN returns all providers as unavailable', async () => {
      mocks.resolveCliBinary.mockResolvedValue(undefined);

      const result = await detectInstalledProviders();

      expect(result).toHaveLength(5);

      for (const provider of result) {
        expect(provider.available).toBe(false);
        expect(provider.binaryPath).toBeUndefined();
      }
    });
  });

  describe('partial availability', () => {
    it('GIVEN only claude binary exists WHEN detecting THEN claude is available and others are not', async () => {
      mocks.resolveCliBinary.mockImplementation(resolveOnlyClaudeBinary);

      const result = await detectInstalledProviders();

      const claude = result.find((p) => p.name === 'claude');
      const others = result.filter((p) => p.name !== 'claude');

      expect(claude).toStrictEqual(
        expect.objectContaining({
          name: 'claude',
          available: true,
          binaryPath: '/usr/bin/claude',
        })
      );

      for (const p of others) {
        expect(p.available).toBe(false);
        expect(p.binaryPath).toBeUndefined();
      }
    });
  });

  describe('provider names', () => {
    it('GIVEN known providers WHEN detecting THEN result contains all expected provider names', async () => {
      mocks.resolveCliBinary.mockResolvedValue(undefined);

      const result = await detectInstalledProviders();
      const names = result.map((p) => p.name);

      expect(names).toStrictEqual(['claude', 'codex', 'copilot', 'gemini', 'opencode']);
    });
  });
});
