import { describe, expect, it } from 'vitest';

import { resolveTimeoutResultWarning } from './complete-result.util';
import type { OutputFormat } from '../../shared/mcp-protocol/common';

const AGY_RESULT_EVENT = '{"event":"result","result":{"status":"SUCCESS","response":"agy answer"}}';
const AGY_STEP_EVENT = '{"event":"step_update","step_update":{"step_index":1,"state":"DONE"}}';

const resolveWarning = (stdout: string, outputFormat: OutputFormat, timedOut = true): string | undefined => {
  const config = { acceptResultOnTimeout: true };
  const result = { stdout, timedOut };
  const warning = resolveTimeoutResultWarning({
    providerName: 'antigravity',
    config,
    result,
    outputFormat,
    wasCancelled: false,
  });

  return warning;
};

describe('FEATURE: timeout result acceptance', () => {
  describe('GIVEN a timed-out stream-json run', () => {
    it('WHEN the last line is a terminal result event THEN a warning naming the provider is returned', () => {
      const stdout = `${AGY_STEP_EVENT}\n${AGY_RESULT_EVENT}\n`;

      const warning = resolveWarning(stdout, 'stream-json');

      expect(warning).toContain('antigravity did not exit');
    });

    it('WHEN the last line is a claude result event THEN a warning is returned', () => {
      const stdout = '{"type":"result","result":"final answer"}';

      const warning = resolveWarning(stdout, 'stream-json');

      expect(warning).toBeDefined();
    });

    it('WHEN the last line is a step event THEN no warning is returned', () => {
      const stdout = `${AGY_RESULT_EVENT}\n${AGY_STEP_EVENT}`;

      const warning = resolveWarning(stdout, 'stream-json');

      expect(warning).toBeUndefined();
    });

    it('WHEN nothing was printed THEN no warning is returned', () => {
      const warning = resolveWarning('', 'stream-json');

      expect(warning).toBeUndefined();
    });
  });

  describe('GIVEN a timed-out json run', () => {
    it('WHEN stdout is a complete envelope wrapped in ansi codes THEN a warning is returned', () => {
      const stdout = '\u001b[0m{"response":"agy answer"}\u001b[0m';

      const warning = resolveWarning(stdout, 'json');

      expect(warning).toBeDefined();
    });

    it('WHEN stdout holds log lines around the envelope THEN no warning is returned', () => {
      const stdout = 'starting\n{"response":"agy answer"}';

      const warning = resolveWarning(stdout, 'json');

      expect(warning).toBeUndefined();
    });
  });

  it('GIVEN a timed-out text run WHEN it printed an answer THEN no warning is returned', () => {
    const warning = resolveWarning('plain answer', 'text');

    expect(warning).toBeUndefined();
  });

  it('GIVEN a run that was not killed WHEN it printed a complete envelope THEN no warning is returned', () => {
    const warning = resolveWarning('{"response":"agy answer"}', 'json', false);

    expect(warning).toBeUndefined();
  });
});
