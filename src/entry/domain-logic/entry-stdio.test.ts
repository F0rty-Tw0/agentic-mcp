import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Client } from '@modelcontextprotocol/client';
import type { VersionNegotiationOptions } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ENTRY_PATH = path.join(import.meta.dirname, '..', '..', 'index.ts');
const CALL_TIMEOUT_MS = 30_000;
const SETTLE_MS = 1_500;
const MODERN_PIN = { pin: '2026-07-28' };
const MODERN_NEGOTIATION: VersionNegotiationOptions = { mode: MODERN_PIN };
const LEGACY_NEGOTIATION: VersionNegotiationOptions = { mode: 'legacy' };

type Era = 'legacy' | 'modern';

type StdioSession = {
  readonly client: Client;
  readonly pidFile: string;
};

const sleep = async (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// A provider CLI that records its pid and prints a line every 200 ms for 8 s.
const buildFakeProviderConfig = (pidFile: string): string => {
  const script = `require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); let i = 0; const t = setInterval(() => { i++; process.stdout.write('line ' + i + '\\n'); if (i === 40) clearInterval(t); }, 200);`;
  const ask = { args: ['-e', script], flags: {} };
  const commands = { ask };
  const input = { method: 'positional' };
  const fake = {
    enabled: true,
    description: 'Fake long-running CLI',
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

const isAlive = async (pid: number): Promise<boolean> => {
  try {
    const stat = await readFile(`/proc/${String(pid)}/stat`, 'utf8');
    const [, afterName = ''] = stat.split(') ');
    const alive = !afterName.startsWith('Z');

    return alive;
  } catch {
    return false;
  }
};

const openSession = async (directory: string, era: Era): Promise<StdioSession> => {
  const pidFile = path.join(directory, 'provider.pid');
  const configPath = path.join(directory, 'providers.json');
  const configText = buildFakeProviderConfig(pidFile);

  await writeFile(configPath, configText, 'utf8');

  const versionNegotiation = era === 'modern' ? MODERN_NEGOTIATION : LEGACY_NEGOTIATION;
  const client = new Client({ name: 'stdio-test', version: '0.0.0' }, { versionNegotiation });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', ENTRY_PATH, '--config', configPath],
    stderr: 'pipe',
  });

  await client.connect(transport);

  const session: StdioSession = { client, pidFile };

  return session;
};

describe.skipIf(process.platform === 'win32')('integration: MCP over stdio in both protocol eras', () => {
  let directory: string;
  let session: StdioSession | undefined;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'agentic-stdio-'));
  });

  afterEach(async () => {
    await session?.client.close();
    session = undefined;
    await rm(directory, { recursive: true, force: true });
  });

  it.each(['legacy', 'modern'] as const)(
    'GIVEN a %s session and a progress token WHEN a long ask runs THEN progress notifications arrive',
    async (era) => {
      session = await openSession(directory, era);
      const progressEvents: unknown[] = [];
      const args = { prompt: 'progress', stream_live: true };
      const call = { name: 'ask_fake', arguments: args };
      const onprogress = (event: unknown): void => {
        progressEvents.push(event);
      };
      const options = { timeout: CALL_TIMEOUT_MS, onprogress };

      await session.client.callTool(call, options);

      expect(progressEvents.length).toBeGreaterThan(0);
    },
    CALL_TIMEOUT_MS
  );

  it.each(['legacy', 'modern'] as const)(
    'GIVEN a %s session WHEN the client cancels a running ask THEN the provider CLI is stopped and the call rejects',
    async (era) => {
      session = await openSession(directory, era);
      const controller = new AbortController();
      const args = { prompt: 'cancel' };
      const call = { name: 'ask_fake', arguments: args };
      const options = { timeout: CALL_TIMEOUT_MS, signal: controller.signal };
      const pending = session.client.callTool(call, options);
      const outcome = pending.then(
        () => 'resolved',
        () => 'rejected'
      );

      await sleep(SETTLE_MS);
      const pidText = await readFile(session.pidFile, 'utf8');
      const pid = Number(pidText);

      controller.abort('test cancel');
      await sleep(SETTLE_MS);

      const settled = await outcome;
      const providerAlive = await isAlive(pid);

      expect(settled).toBe('rejected');
      expect(providerAlive).toBe(false);
    },
    CALL_TIMEOUT_MS
  );
});
