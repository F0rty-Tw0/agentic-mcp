import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runCli } from './cli.router';
import { ASK_STREAM_EVENT_SCHEMA } from '../../streaming/common';
import type { CliSubcommand } from '../common';
import type { CallCliToolInput } from '../utils/in-process-mcp-client.util';

const mocks = vi.hoisted(() => ({
  callCliTool: vi.fn<(input: CallCliToolInput) => Promise<CallToolResult>>(),
}));

vi.mock('../utils/in-process-mcp-client.util', () => ({
  callCliTool: mocks.callCliTool,
}));

const buildSuccessResult = (): CallToolResult => ({
  content: [{ type: 'text', text: 'ok' }],
});

const buildErrorResult = (): CallToolResult => ({
  content: [{ type: 'text', text: 'boom' }],
  isError: true,
});

const buildLiveChunkMessage = (): string => {
  const result = JSON.stringify({
    schema: ASK_STREAM_EVENT_SCHEMA,
    type: 'chunk',
    streamId: 'stream-1',
    sequence: 1,
    timestamp: '2026-03-08T00:00:00.000Z',
    channel: 'stdout',
    chunk: 'live',
  });

  return result;
};

describe('runCli', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    process.exitCode = undefined;
    mocks.callCliTool.mockReset();
    mocks.callCliTool.mockResolvedValue(buildSuccessResult());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('GIVEN ask_claude WHEN run THEN it calls the MCP helper with the exact tool name', async () => {
    await runCli('ask_claude', ['hello']);

    expect(mocks.callCliTool).toHaveBeenCalledWith({
      toolName: 'ask_claude',
      args: { prompt: 'hello' },
      configPath: undefined,
    });
    expect(stdoutSpy).toHaveBeenCalledWith('ok\n');
  });

  it('GIVEN ask_all WHEN run THEN it calls the MCP helper with the exact tool name', async () => {
    await runCli('ask_all', ['hello']);

    expect(mocks.callCliTool).toHaveBeenCalledWith({
      toolName: 'ask_all',
      args: { prompt: 'hello' },
      configPath: undefined,
    });
    expect(stdoutSpy).toHaveBeenCalledWith('ok\n');
  });

  it('GIVEN ping_claude WHEN run THEN it calls the MCP helper with the exact tool name', async () => {
    await runCli('ping_claude', []);

    expect(mocks.callCliTool).toHaveBeenCalledWith({
      toolName: 'ping_claude',
      args: {},
      configPath: undefined,
    });
    expect(stdoutSpy).toHaveBeenCalledWith('ok\n');
  });

  it('GIVEN sessions_claude WHEN run THEN it calls the MCP helper with the exact tool name', async () => {
    await runCli('sessions_claude', []);

    expect(mocks.callCliTool).toHaveBeenCalledWith({
      toolName: 'sessions_claude',
      args: {},
      configPath: undefined,
    });
    expect(stdoutSpy).toHaveBeenCalledWith('ok\n');
  });

  it('GIVEN ask_claude with --stream-live WHEN run THEN it forwards stream_live and renders live progress', async () => {
    mocks.callCliTool.mockImplementationOnce(async (input) => {
      input.onProgress?.({
        progress: 1,
        message: buildLiveChunkMessage(),
      });

      const result = await Promise.resolve(buildSuccessResult());

      return result;
    });

    await runCli('ask_claude', ['hello', '--stream-live']);

    const callCliToolInput = mocks.callCliTool.mock.calls[0]?.[0];

    expect(callCliToolInput).toMatchObject({
      toolName: 'ask_claude',
      args: { prompt: 'hello', stream_live: true },
      configPath: undefined,
    });
    expect(typeof callCliToolInput?.onProgress).toBe('function');
    expect(stdoutSpy).toHaveBeenNthCalledWith(1, 'live');
    expect(stdoutSpy).toHaveBeenNthCalledWith(2, 'ok\n');
  });

  it('GIVEN an unknown command WHEN run THEN it writes an error to stderr and sets exitCode to 1', async () => {
    await runCli('unknown_cmd' as CliSubcommand, []);

    expect(mocks.callCliTool).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledWith('Unknown command: unknown_cmd\n');
    expect(process.exitCode).toBe(1);
  });

  it('GIVEN the MCP helper returns an error result WHEN run THEN it writes to stderr and sets exitCode to 1', async () => {
    mocks.callCliTool.mockResolvedValueOnce(buildErrorResult());

    await runCli('provider_metrics', []);

    expect(stderrSpy).toHaveBeenCalledWith('boom\n');
    expect(process.exitCode).toBe(1);
  });
});
