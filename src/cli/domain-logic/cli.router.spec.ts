import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { runCli } from './cli.router';
import { ASK_STREAM_EVENT_SCHEMA } from '../../streaming/common';
import type { CallCliToolInput, CliSubcommand } from '../common';

const mocks = vi.hoisted(() => ({
  callCliTool: vi.fn<(input: CallCliToolInput) => Promise<CallToolResult>>(),
  writeAskAllReport: vi.fn<(input: Readonly<{ reportPath: string; result: CallToolResult }>) => Promise<void>>(),
}));

vi.mock('../utils/in-process-mcp-client.util', () => ({
  callCliTool: mocks.callCliTool,
}));

vi.mock('./ask-all-report.writer', () => ({
  writeAskAllReport: mocks.writeAskAllReport,
}));

const buildSuccessResult = (): CallToolResult => ({
  content: [{ type: 'text', text: 'ok' }],
});

const buildAskAllSuccessResult = (): CallToolResult => ({
  content: [{ type: 'text', text: 'Comparison complete for 2 providers' }],
  structuredContent: {
    prompt: 'hello',
    totalProviders: 2,
    succeeded: 2,
    failed: 0,
    totalExecutionTimeMs: 42,
    results: [
      { provider: 'claude', success: true, executionTimeMs: 20, response: 'ok' },
      { provider: 'codex', success: true, executionTimeMs: 22, response: 'ok' },
    ],
  },
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
  let stdoutSpy: MockInstance;
  let stderrSpy: MockInstance;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    process.exitCode = undefined;
    mocks.callCliTool.mockReset();
    mocks.writeAskAllReport.mockReset();
    mocks.callCliTool.mockResolvedValue(buildSuccessResult());
    mocks.writeAskAllReport.mockResolvedValue(undefined);
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

  it('GIVEN ask_all with --models alias WHEN run THEN it normalizes the value and calls the MCP helper', async () => {
    await runCli('ask_all', ['hello', '--models', 'claude-sonnet-4']);

    expect(mocks.callCliTool).toHaveBeenCalledWith({
      toolName: 'ask_all',
      args: { prompt: 'hello', model: 'claude-sonnet-4' },
      configPath: undefined,
    });
  });

  it('GIVEN ask_all with unsupported flag WHEN run THEN it writes an error to stderr and does not call the MCP helper', async () => {
    await runCli('ask_all', ['hello', '--unknown', 'gemini']);

    expect(mocks.callCliTool).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledWith(
      'Validation error: Unknown flag "--unknown" for ask_all. Use --providers or --model for supported ask_all options.\n'
    );
    expect(process.exitCode).toBe(1);
  });

  it('GIVEN ask_all with --report WHEN run THEN it strips the report flag, writes the artifact, and prints a saved message', async () => {
    const result = buildAskAllSuccessResult();

    mocks.callCliTool.mockResolvedValueOnce(result);

    await runCli('ask_all', ['hello', '--report', '/tmp/report.json']);

    expect(mocks.callCliTool).toHaveBeenCalledWith({
      toolName: 'ask_all',
      args: { prompt: 'hello' },
      configPath: undefined,
    });
    expect(mocks.writeAskAllReport).toHaveBeenCalledWith({
      reportPath: '/tmp/report.json',
      result,
    });
    expect(stdoutSpy).toHaveBeenNthCalledWith(1, 'Comparison complete for 2 providers\n');
    expect(stdoutSpy).toHaveBeenNthCalledWith(2, 'Report saved to /tmp/report.json\n');
  });

  it('GIVEN ask_all with --report and no path WHEN run THEN it writes a validation error and does not call the MCP helper', async () => {
    await runCli('ask_all', ['hello', '--report']);

    expect(mocks.callCliTool).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledWith('Validation error: ask_all requires a file path after --report.\n');
    expect(process.exitCode).toBe(1);
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

  it('GIVEN review_codex WHEN run THEN it calls the MCP helper with parsed review args', async () => {
    await runCli('review_codex', ['--scope', 'uncommitted', '--working-dir', '/repo']);

    const callCliToolInput = mocks.callCliTool.mock.calls[0]?.[0];

    expect(callCliToolInput).toMatchObject({
      toolName: 'review_codex',
      args: { scope: 'uncommitted', working_directory: '/repo', stream_live: true },
      configPath: undefined,
    });
    expect(typeof callCliToolInput?.onProgress).toBe('function');
    expect(stdoutSpy).toHaveBeenCalledWith('ok\n');
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
