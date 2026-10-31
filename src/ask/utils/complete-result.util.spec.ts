import { describe, expect, it } from 'vitest';

import { createResultEnvelopeDetector, resolveTimeoutResultWarning } from './complete-result.util';
import type { OutputFormat } from '../../shared/mcp-protocol/common';

const AGY_RESULT_EVENT = '{"event":"result","result":{"status":"SUCCESS","response":"agy answer"}}';
const AGY_ERROR_RESULT_EVENT =
  '{"event":"result","result":{"status":"ERROR","error":"RESOURCE_EXHAUSTED: quota","response":"I started to answer but"}}';
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

    it('WHEN the terminal result event carries an error THEN no warning is returned', () => {
      const stdout = `${AGY_STEP_EVENT}\n${AGY_ERROR_RESULT_EVENT}\n`;

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

    it('WHEN the envelope carries an error THEN no warning is returned', () => {
      const stdout = '{"status":"ERROR","error":"RESOURCE_EXHAUSTED: quota","response":"I started to answer but"}';

      const warning = resolveWarning(stdout, 'json');

      expect(warning).toBeUndefined();
    });

    it('WHEN the envelope finished with reason error THEN no warning is returned', () => {
      const stdout = '{"status":"SUCCESS","response":"I started to answer but","finished_reason":"error"}';

      const warning = resolveWarning(stdout, 'json');

      expect(warning).toBeUndefined();
    });

    it('WHEN the envelope finished with reason interrupted THEN no warning is returned', () => {
      const stdout = '{"status":"SUCCESS","response":"I started to answer but","finished_reason":"interrupted"}';

      const warning = resolveWarning(stdout, 'json');

      expect(warning).toBeUndefined();
    });

    it('WHEN the envelope has an empty error THEN a warning is returned', () => {
      const stdout = '{"status":"SUCCESS","response":"agy answer","error":""}';

      const warning = resolveWarning(stdout, 'json');

      expect(warning).toBeDefined();
    });

    it('WHEN the envelope answer comes with status ERROR and no error THEN the warning names the status', () => {
      const stdout = '{"status":"ERROR","response":"agy answer"}';

      const warning = resolveWarning(stdout, 'json');

      expect(warning).toContain('status ERROR');
    });

    it('WHEN the envelope status is SUCCESS THEN the warning does not mention a status', () => {
      const stdout = '{"status":"SUCCESS","response":"agy answer"}';

      const warning = resolveWarning(stdout, 'json');

      expect(warning).not.toContain('status');
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

describe('FEATURE: result envelope detector', () => {
  describe('GIVEN a stream-json detector', () => {
    it('WHEN a terminal result event arrives split across chunks THEN the last chunk reports completion', () => {
      const isComplete = createResultEnvelopeDetector('stream-json');
      const half = Math.floor(AGY_RESULT_EVENT.length / 2);
      const firstChunk = `${AGY_STEP_EVENT}\n${AGY_RESULT_EVENT.slice(0, half)}`;
      const lastChunk = `${AGY_RESULT_EVENT.slice(half)}\n`;

      const firstCompleted = isComplete(firstChunk);
      const lastCompleted = isComplete(lastChunk);

      expect([firstCompleted, lastCompleted]).toStrictEqual([false, true]);
    });

    it('WHEN the terminal result line has no trailing newline THEN it reports completion', () => {
      const isComplete = createResultEnvelopeDetector('stream-json');

      const completed = isComplete(AGY_RESULT_EVENT);

      expect(completed).toBe(true);
    });

    it('WHEN only step events arrive THEN it reports no completion', () => {
      const isComplete = createResultEnvelopeDetector('stream-json');

      const completed = isComplete(`${AGY_STEP_EVENT}\n${AGY_STEP_EVENT}\n`);

      expect(completed).toBe(false);
    });
  });

  describe('GIVEN a json detector', () => {
    it('WHEN the envelope arrives in two chunks THEN only the last chunk reports completion', () => {
      const isComplete = createResultEnvelopeDetector('json');

      const firstCompleted = isComplete('{"status":"SUCCESS",');
      const lastCompleted = isComplete('"response":"agy answer"}\n');

      expect([firstCompleted, lastCompleted]).toStrictEqual([false, true]);
    });

    it('WHEN the envelope has an empty answer THEN it reports no completion', () => {
      const isComplete = createResultEnvelopeDetector('json');

      const completed = isComplete('{"status":"SUCCESS","response":""}');

      expect(completed).toBe(false);
    });
  });

  it('GIVEN a text detector WHEN output arrives THEN it never reports completion', () => {
    const isComplete = createResultEnvelopeDetector('text');

    const completed = isComplete('{"response":"agy answer"}');

    expect(completed).toBe(false);
  });
});
