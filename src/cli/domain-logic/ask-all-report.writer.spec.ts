import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeAskAllReport } from './ask-all-report.writer';
import { ValidationError } from '../../shared';

type MkdirOptions = {
  readonly recursive: boolean;
};

type ContentPart = CallToolResult['content'][number];

const fsMocks = vi.hoisted(() => {
  const mocks = {
    mkdir: vi.fn<(targetPath: string, options: MkdirOptions) => Promise<void>>(),
    writeFile: vi.fn<(targetPath: string, content: string, encoding: 'utf8') => Promise<void>>(),
  };

  return mocks;
});

vi.mock('node:fs/promises', () => {
  const fsModule = {
    mkdir: fsMocks.mkdir,
    writeFile: fsMocks.writeFile,
  };

  return fsModule;
});

const SUMMARY_PART: ContentPart = { type: 'text', text: 'summary' };

const buildStructuredContent = (): Record<string, unknown> => {
  const claudeResult = { provider: 'claude', success: true, executionTimeMs: 20, response: 'ok' };
  const codexResult = { provider: 'codex', success: false, executionTimeMs: 22, error: 'failed' };
  const results = [claudeResult, codexResult];
  const structuredContent = {
    prompt: 'hello',
    totalProviders: 2,
    succeeded: 1,
    failed: 1,
    totalExecutionTimeMs: 42,
    results,
  };

  return structuredContent;
};

describe('writeAskAllReport', () => {
  beforeEach(() => {
    fsMocks.mkdir.mockReset();
    fsMocks.writeFile.mockReset();
    fsMocks.mkdir.mockResolvedValue(undefined);
    fsMocks.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GIVEN structured ask_all result and json path WHEN writing report THEN it creates the parent directory and writes formatted JSON', async () => {
    const structuredContent = buildStructuredContent();
    const content = [SUMMARY_PART];
    const result: CallToolResult = { content, structuredContent };

    await writeAskAllReport({
      reportPath: '/tmp/reports/ask-all-report.json',
      result,
    });

    expect(fsMocks.mkdir).toHaveBeenCalledWith('/tmp/reports', { recursive: true });
    expect(fsMocks.writeFile).toHaveBeenCalledWith(
      '/tmp/reports/ask-all-report.json',
      `${JSON.stringify(structuredContent, null, 2)}\n`,
      'utf8'
    );
  });

  it('GIVEN structured ask_all result and markdown path WHEN writing report THEN it writes a shareable markdown report', async () => {
    const structuredContent = buildStructuredContent();
    const content = [SUMMARY_PART];
    const result: CallToolResult = { content, structuredContent };

    await writeAskAllReport({
      reportPath: '/tmp/reports/ask-all-report.md',
      result,
    });

    expect(fsMocks.mkdir).toHaveBeenCalledWith('/tmp/reports', { recursive: true });
    const expectedLines = [
      '# Provider comparison report',
      '',
      '- Prompt: hello',
      '- Providers: 2',
      '- Succeeded: 1',
      '- Failed: 1',
      '- Total execution time: 42ms',
      '',
      '## claude',
      '- Status: success',
      '- Execution time: 20ms',
      '',
      '### Response',
      '```text',
      'ok',
      '```',
      '',
      '## codex',
      '- Status: failed',
      '- Execution time: 22ms',
      '',
      '### Error',
      '```text',
      'failed',
      '```',
    ];
    const expectedReport = expectedLines.join('\n');

    expect(fsMocks.writeFile).toHaveBeenCalledWith('/tmp/reports/ask-all-report.md', expectedReport, 'utf8');
  });

  it('GIVEN ask_all result without structured content WHEN writing report THEN it throws ValidationError', async () => {
    const content = [SUMMARY_PART];
    const result: CallToolResult = { content };
    const resultPromise = writeAskAllReport({
      reportPath: '/tmp/reports/ask-all-report.json',
      result,
    });

    await expect(resultPromise).rejects.toBeInstanceOf(ValidationError);
    await expect(resultPromise).rejects.toThrow('ask_all report export requires structured comparison data');
    expect(fsMocks.mkdir).not.toHaveBeenCalled();
    expect(fsMocks.writeFile).not.toHaveBeenCalled();
  });

  it('GIVEN structured content that is not an ask_all comparison WHEN writing report THEN it throws ValidationError', async () => {
    const content = [SUMMARY_PART];
    const structuredContent = { response: 'hello' };
    const result: CallToolResult = { content, structuredContent };
    const resultPromise = writeAskAllReport({
      reportPath: '/tmp/reports/ask-all-report.json',
      result,
    });

    await expect(resultPromise).rejects.toThrow('ask_all report export requires structured comparison data');
    expect(fsMocks.writeFile).not.toHaveBeenCalled();
  });
});
