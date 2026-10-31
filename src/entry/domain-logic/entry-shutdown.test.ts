import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CHILD_GROUP_KILL_GRACE_MS } from '../../shared';
import { SHUTDOWN_CLOSE_TIMEOUT_MS } from '../common';
import { isProcessDead, waitForPid, waitUntilDead } from '../test/utils/provider-process.spec.util';

const DIST_ENTRY_PATH = path.join(import.meta.dirname, '..', '..', '..', 'dist', 'index.js');
// Close and the group kill run side by side, so their sum bounds the exit with headroom.
const SHUTDOWN_BUDGET_MS = SHUTDOWN_CLOSE_TIMEOUT_MS + CHILD_GROUP_KILL_GRACE_MS;
const PROVIDER_START_LIMIT_MS = 15_000;
const REAP_LIMIT_MS = 1_000;
const TEST_TIMEOUT_MS = 30_000;

type ShutdownRun = {
  readonly client: Client;
  readonly serverPid: number;
  readonly providerPid: number;
};

// A provider CLI that ignores SIGTERM, records its pid once the trap is set, and idles.
const buildFakeProviderConfig = (pidFile: string): string => {
  const script = `process.on('SIGTERM', () => undefined); require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => undefined, 1000);`;
  const ask = { args: ['-e', script], flags: {} };
  const commands = { ask };
  const input = { method: 'positional' };
  const fake = {
    enabled: true,
    description: 'Fake CLI that ignores SIGTERM',
    command: 'node',
    timeout: 60_000,
    env: {},
    outputFormat: 'text',
    commands,
    input,
  };
  const providers = { fake };
  const config = { configVersion: 1, providers };
  const configText = JSON.stringify(config);

  return configText;
};

// Starts an ask without awaiting it, then sends SIGTERM to the server once the provider runs.
const startAskAndSigterm = async (directory: string): Promise<ShutdownRun> => {
  const pidFile = path.join(directory, 'provider.pid');
  const configPath = path.join(directory, 'providers.json');
  const configText = buildFakeProviderConfig(pidFile);

  await writeFile(configPath, configText, 'utf8');

  const client = new Client({ name: 'shutdown-test', version: '0.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [DIST_ENTRY_PATH, '--config', configPath],
    stderr: 'pipe',
  });

  await client.connect(transport);

  const args = { prompt: 'shutdown' };
  const call = { name: 'ask_fake', arguments: args };
  const options = { timeout: TEST_TIMEOUT_MS };
  const pending = client.callTool(call, options);

  pending.catch(() => undefined);

  const providerPid = await waitForPid(pidFile, PROVIDER_START_LIMIT_MS);
  const serverPid = transport.pid;

  if (providerPid === undefined || serverPid === null) {
    // Closing the client stops the server, which stops its provider group, so a failed start leaks nothing.
    await client.close();

    throw new Error('server or provider did not start');
  }

  process.kill(serverPid, 'SIGTERM');

  const run: ShutdownRun = { client, serverPid, providerPid };

  return run;
};

const killIfAlive = (pid: number): void => {
  const isDead = isProcessDead(pid);

  if (isDead) return;

  process.kill(pid, 'SIGKILL');
};

// A failed run must not leak a server or a provider that ignores SIGTERM.
const disposeRun = async (run: ShutdownRun | undefined): Promise<void> => {
  if (!run) return;

  killIfAlive(run.serverPid);
  killIfAlive(run.providerPid);
  await run.client.close();
};

describe.skipIf(process.platform !== 'linux')('FEATURE: server-mode shutdown stops provider CLIs', () => {
  let directory: string;
  let run: ShutdownRun | undefined;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'agentic-shutdown-'));
  });

  afterEach(async () => {
    await disposeRun(run);
    run = undefined;
    await rm(directory, { recursive: true, force: true });
  });

  describe('GIVEN an ask running on a provider CLI that ignores SIGTERM', () => {
    describe('WHEN the server process gets SIGTERM', () => {
      it(
        'THEN the server exits within the shutdown budget',
        async () => {
          run = await startAskAndSigterm(directory);

          const serverStopped = await waitUntilDead(run.serverPid, SHUTDOWN_BUDGET_MS);

          expect(serverStopped).toBe(true);
        },
        TEST_TIMEOUT_MS
      );

      it(
        'THEN the provider CLI is dead once the server has exited',
        async () => {
          run = await startAskAndSigterm(directory);

          await waitUntilDead(run.serverPid, SHUTDOWN_BUDGET_MS);
          const providerStopped = await waitUntilDead(run.providerPid, REAP_LIMIT_MS);

          expect(providerStopped).toBe(true);
        },
        TEST_TIMEOUT_MS
      );
    });
  });
});
