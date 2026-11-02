import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readPid } from './provider-process.spec.util';

describe('FEATURE: readPid', () => {
  let directory: string;
  let pidFile: string;

  const readPidText = async (pidText: string): Promise<number | undefined> => {
    await writeFile(pidFile, pidText, 'utf8');

    const pid = await readPid(pidFile);

    return pid;
  };

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'agentic-read-pid-'));
    pidFile = path.join(directory, 'provider.pid');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  describe('GIVEN a pid file caught between truncate and write', () => {
    it('WHEN it is read THEN no pid is returned', async () => {
      const pid = await readPidText('');

      expect(pid).toBeUndefined();
    });
  });

  describe('GIVEN a pid file holding text that is not a number', () => {
    it('WHEN it is read THEN no pid is returned', async () => {
      const pid = await readPidText('abc');

      expect(pid).toBeUndefined();
    });
  });

  describe('GIVEN a pid file holding 0', () => {
    it('WHEN it is read THEN no pid is returned', async () => {
      const pid = await readPidText('0');

      expect(pid).toBeUndefined();
    });
  });

  describe('GIVEN a pid file holding a negative number', () => {
    it('WHEN it is read THEN no pid is returned', async () => {
      const pid = await readPidText('-5');

      expect(pid).toBeUndefined();
    });
  });

  describe('GIVEN a pid file holding a fraction', () => {
    it('WHEN it is read THEN no pid is returned', async () => {
      const pid = await readPidText('12.5');

      expect(pid).toBeUndefined();
    });
  });

  describe('GIVEN a pid file holding a positive integer', () => {
    it('WHEN it is read THEN that pid is returned', async () => {
      const pid = await readPidText('123');

      expect(pid).toBe(123);
    });
  });

  describe('GIVEN no pid file yet', () => {
    it('WHEN it is read THEN no pid is returned', async () => {
      const pid = await readPid(pidFile);

      expect(pid).toBeUndefined();
    });
  });
});
