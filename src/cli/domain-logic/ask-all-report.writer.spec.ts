import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeAskAllReport } from './ask-all-report.writer';
import { ValidationError } from '../../shared';

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn<(targetPath: string, options: { recursive: boolean }) => Promise<void>>(),
  writeFile: vi.fn<(targetPath: string, content: string, encoding: 'utf8') => Promise<void>>(),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: fsMocks.mkdir,
  writeFile: fsMocks.writeFile,
}));

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
    const structuredContent = {
      prompt: 'hello',
      totalProviders: 2,
      succeeded: 1,
      failed: 1,
      totalExecutionTimeMs: 42,
      results: [
        { provider: 'claude', success: true, executionTimeMs: 20, response: 'ok' },
        { provider: 'codex', success: false, executionTimeMs: 22, error: 'failed' },
      ],
    };

    await writeAskAllReport({
      reportPath: '/tmp/reports/ask-all-report.json',
      result: {
        content: [{ type: 'text', text: 'summary' }],
        structuredContent,
      },
    });

    expect(fsMocks.mkdir).toHaveBeenCalledWith('/tmp/reports', { recursive: true });
    expect(fsMocks.writeFile).toHaveBeenCalledWith(
      '/tmp/reports/ask-all-report.json',
      `${JSON.stringify(structuredContent, null, 2)}\n`,
      'utf8'
    );
  });

  it('GIVEN structured ask_all result and markdown path WHEN writing report THEN it writes a shareable markdown report', async () => {
    const structuredContent = {
      prompt: 'hello',
      totalProviders: 2,
      succeeded: 1,
      failed: 1,
      totalExecutionTimeMs: 42,
      results: [
        { provider: 'claude', success: true, executionTimeMs: 20, response: 'ok' },
        { provider: 'codex', success: false, executionTimeMs: 22, error: 'failed' },
      ],
    };

    await writeAskAllReport({
      reportPath: '/tmp/reports/ask-all-report.md',
      result: {
        content: [{ type: 'text', text: 'summary' }],
        structuredContent,
      },
    });

    expect(fsMocks.mkdir).toHaveBeenCalledWith('/tmp/reports', { recursive: true });
    expect(fsMocks.writeFile).toHaveBeenCalledWith(
      '/tmp/reports/ask-all-report.md',
      [
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
      ].join('\n'),
      'utf8'
    );
  });

  it('GIVEN ask_all result without structured content WHEN writing report THEN it throws ValidationError', async () => {
    const resultPromise = writeAskAllReport({
      reportPath: '/tmp/reports/ask-all-report.json',
      result: {
        content: [{ type: 'text', text: 'summary' }],
      },
    });

    await expect(resultPromise).rejects.toBeInstanceOf(ValidationError);
    await expect(resultPromise).rejects.toThrow('ask_all report export requires structured comparison data');
    expect(fsMocks.mkdir).not.toHaveBeenCalled();
    expect(fsMocks.writeFile).not.toHaveBeenCalled();
  });
});
