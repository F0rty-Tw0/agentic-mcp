import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isJSONRPCErrorResponse, isJSONRPCRequest, isJSONRPCResultResponse } from '@modelcontextprotocol/sdk/types.js';
import type { JSONRPCMessage, RequestId } from '@modelcontextprotocol/sdk/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createServer } from './create-server';
import type { ProviderConfig, ProvidersFile } from '../../shared/provider/common';

type SpawnLogEntry = {
  readonly name: string;
  readonly pid: number;
};

type ClientTrace = {
  readonly toolCallIds: RequestId[];
  readonly responseIds: RequestId[];
};

type CallOutcome = 'completed' | 'cancelled';

const POLL_INTERVAL_MS = 20;
const WAIT_LIMIT_MS = 5000;
const SETTLE_MS = 400;

let workDir: string;
let spawnLogPath: string;
let server: McpServer;
let client: Client;
let trace: ClientTrace;

const buildFakeCliScript = (logPath: string): string => {
  const logPathLiteral = JSON.stringify(logPath);
  const statements = [
    "const fs = require('node:fs');",
    "const [name, delayMs] = process.argv[1].split(':');",
    `fs.appendFileSync(${logPathLiteral}, name + ' ' + process.pid + '\\n');`,
    "setTimeout(() => process.stdout.write('done ' + name), Number(delayMs));",
  ];
  const script = statements.join(' ');

  return script;
};

const buildProviderConfig = (logPath: string): ProviderConfig => {
  const script = buildFakeCliScript(logPath);
  const ask = { args: ['-e', script], flags: {} };
  const commands = { ask };
  const input = { method: 'positional' } as const;
  const providerConfig: ProviderConfig = {
    enabled: true,
    description: 'Fake CLI that logs each spawn and sleeps',
    command: process.execPath,
    timeout: 60_000,
    maxConcurrency: 1,
    queueTimeoutMs: 30_000,
    env: {},
    outputFormat: 'text',
    commands,
    input,
  };

  return providerConfig;
};

const writeProvidersFile = (dir: string, logPath: string): string => {
  const fake = buildProviderConfig(logPath);
  const providers = { fake };
  const providersFile: ProvidersFile = { configVersion: 1, providers };
  const configPath = join(dir, 'providers.json');

  writeFileSync(configPath, JSON.stringify(providersFile));

  return configPath;
};

const parseSpawnLogLine = (line: string): SpawnLogEntry => {
  const [name = '', pidText = ''] = line.split(' ');
  const entry: SpawnLogEntry = { name, pid: Number(pidText) };

  return entry;
};

const readSpawnLog = (): SpawnLogEntry[] => {
  const hasSpawnLog = existsSync(spawnLogPath);

  if (!hasSpawnLog) return [];

  const lines = readFileSync(spawnLogPath, 'utf8').trim().split('\n');
  const entries = lines.map(parseSpawnLogLine);

  return entries;
};

const readSpawnedNames = (): string[] => {
  const entries = readSpawnLog();
  const names = entries.map((entry) => entry.name);

  return names;
};

const findSpawn = (name: string): SpawnLogEntry | undefined => {
  const entries = readSpawnLog();
  const entry = entries.find((candidate) => candidate.name === name);

  return entry;
};

const waitForSpawn = async (name: string): Promise<SpawnLogEntry> => {
  const deadline = Date.now() + WAIT_LIMIT_MS;

  while (Date.now() < deadline) {
    const entry = findSpawn(name);

    if (entry) return entry;

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`fake CLI "${name}" never spawned`);
};

const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

const recordOutgoing = (message: JSONRPCMessage, clientTrace: ClientTrace): void => {
  const isToolCall = isJSONRPCRequest(message) && message.method === 'tools/call';

  if (isToolCall) clientTrace.toolCallIds.push(message.id);
};

const readResponseId = (message: JSONRPCMessage): RequestId | undefined => {
  if (isJSONRPCResultResponse(message)) return message.id;

  if (isJSONRPCErrorResponse(message)) return message.id;

  return undefined;
};

const recordIncoming = (message: JSONRPCMessage, clientTrace: ClientTrace): void => {
  const responseId = readResponseId(message);

  if (responseId !== undefined) clientTrace.responseIds.push(responseId);
};

const traceTransport = (transport: InMemoryTransport, clientTrace: ClientTrace): void => {
  const send = transport.send.bind(transport);
  const forward = transport.onmessage;

  transport.send = async (message, options): Promise<void> => {
    recordOutgoing(message, clientTrace);
    await send(message, options);
  };
  transport.onmessage = (message, extra): void => {
    recordIncoming(message, clientTrace);
    forward?.(message, extra);
  };
};

const callFake = async (prompt: string, signal?: AbortSignal): Promise<CallOutcome> => {
  const toolArguments = { prompt };
  const params = { name: 'ask_fake', arguments: toolArguments };
  const options = { signal };

  try {
    await client.callTool(params, undefined, options);

    return 'completed';
  } catch {
    return 'cancelled';
  }
};

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'agentic-mcp-cancel-'));
  spawnLogPath = join(workDir, 'spawns.log');

  const configPath = writeProvidersFile(workDir, spawnLogPath);

  server = await createServer({ configPath });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  client = new Client({ name: 'cancellation-integration-test', version: '0.0.0' });
  await client.connect(clientTransport);

  trace = { toolCallIds: [], responseIds: [] };
  traceTransport(clientTransport, trace);
});

afterAll(async () => {
  await client.close();
  await server.close();
  rmSync(workDir, { recursive: true, force: true });
});

describe('integration: MCP request cancellation', () => {
  it('GIVEN a call waiting in the provider queue WHEN the client cancels it THEN the CLI never spawns and no response is sent', async () => {
    const firstCall = callFake('first:1500');

    await waitForSpawn('first');

    const controller = new AbortController();
    const queuedCall = callFake('queued:0', controller.signal);

    await sleep(100);
    controller.abort('test cancel');
    await queuedCall;
    await firstCall;
    await sleep(SETTLE_MS);

    const queuedCallId = trace.toolCallIds[1];

    expect(readSpawnedNames()).toStrictEqual(['first']);
    expect(trace.responseIds).not.toContain(queuedCallId);
  });

  it('GIVEN a running call WHEN the client cancels it THEN the CLI is killed and no response is sent', async () => {
    const controller = new AbortController();
    const runningCall = callFake('running:20000', controller.signal);
    const spawn = await waitForSpawn('running');

    controller.abort('test cancel');
    await runningCall;
    await sleep(SETTLE_MS);

    const runningCallId = trace.toolCallIds[2];

    expect(isProcessAlive(spawn.pid)).toBe(false);
    expect(trace.responseIds).not.toContain(runningCallId);
  });
});
