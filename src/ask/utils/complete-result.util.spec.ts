import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createResultEnvelopeDetector,
  resolveResultWarnings,
  resolveTimeoutResultWarning,
} from './complete-result.util';
import { MAX_OUTPUT_BYTES } from '../../shared/command-execution/common';
import type { OutputFormat } from '../../shared/mcp-protocol/common';

const AGY_RESULT_EVENT = '{"event":"result","result":{"status":"SUCCESS","response":"agy answer"}}';
const AGY_ERROR_RESULT_EVENT =
  '{"event":"result","result":{"status":"ERROR","error":"RESOURCE_EXHAUSTED: quota","response":"I started to answer but"}}';
const AGY_STEP_EVENT = '{"event":"step_update","step_update":{"step_index":1,"state":"DONE"}}';

const NESTED_STEP_COUNT = 50;

const feedNestedEnvelope = (isComplete: (chunk: string) => boolean): boolean => {
  isComplete('{"response":"agy answer","steps":[');

  for (let step = 0; step < NESTED_STEP_COUNT; step += 1) {
    isComplete('{"step":1}');
    isComplete(',');
  }

  const completed = isComplete('{"step":2}]}');

  return completed;
};

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

const resolveAttributionWarning = (
  stdout: string,
  outputFormat: OutputFormat,
  timedOut = false
): string | undefined => {
  const config = { acceptResultOnTimeout: true };
  const result = { stdout, timedOut };
  const resultWarnings = resolveResultWarnings({
    providerName: 'antigravity',
    config,
    result,
    outputFormat,
    wasCancelled: false,
  });

  return resultWarnings.warning;
};

describe('FEATURE: result warnings', () => {
  describe('GIVEN a json run that exited on its own', () => {
    it('WHEN the envelope finished with reason print_timeout THEN the warning says the answer may be partial', () => {
      const stdout = '{"status":"SUCCESS","response":"half","finished_reason":"print_timeout"}\n';

      const warning = resolveAttributionWarning(stdout, 'json');

      expect(warning).toBe('antigravity finished with finished_reason "print_timeout", so the answer may be partial.');
    });

    it('WHEN the envelope has no finished_reason THEN there is no warning', () => {
      const warning = resolveAttributionWarning('{"status":"SUCCESS","response":"agy answer"}', 'json');

      expect(warning).toBeUndefined();
    });
  });

  it('GIVEN a stream-json run that exited on its own WHEN the result event finished with reason print_timeout THEN the warning names it', () => {
    const stdout = `${AGY_STEP_EVENT}\n{"event":"result","result":{"response":"half","finished_reason":"print_timeout"}}\n`;

    const warning = resolveAttributionWarning(stdout, 'stream-json');

    expect(warning).toContain('"print_timeout"');
  });

  describe('GIVEN a timed-out json run whose envelope finished with reason print_timeout', () => {
    const stdout = '{"status":"SUCCESS","response":"half","finished_reason":"print_timeout"}';

    it('WHEN the result is accepted THEN the warning says the process was stopped', () => {
      const warning = resolveAttributionWarning(stdout, 'json', true);

      expect(warning).toContain('antigravity did not exit');
    });

    it('WHEN the result is accepted THEN the warning also names the finished_reason', () => {
      const warning = resolveAttributionWarning(stdout, 'json', true);

      expect(warning).toContain('"print_timeout"');
    });
  });
});

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

    describe('WHEN many chunks close nested objects before the envelope closes', () => {
      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('THEN only the closing chunk reports completion', () => {
        const isComplete = createResultEnvelopeDetector('json');

        const completed = feedNestedEnvelope(isComplete);

        expect(completed).toBe(true);
      });

      it('THEN the buffered output is parsed once', () => {
        const parseSpy = vi.spyOn(JSON, 'parse');
        const isComplete = createResultEnvelopeDetector('json');

        feedNestedEnvelope(isComplete);

        expect(parseSpy).toHaveBeenCalledTimes(1);
      });
    });

    it('WHEN the output grows past the stdout cap THEN it reports no completion', () => {
      const isComplete = createResultEnvelopeDetector('json');

      isComplete(' '.repeat(MAX_OUTPUT_BYTES));

      const completed = isComplete('{"response":"agy answer"}');

      expect(completed).toBe(false);
    });

    it('WHEN the output fills the stdout cap exactly THEN the envelope still reports completion', () => {
      const isComplete = createResultEnvelopeDetector('json');
      const envelope = '{"response":"agy answer"}';

      isComplete(' '.repeat(MAX_OUTPUT_BYTES - envelope.length));

      const completed = isComplete(envelope);

      expect(completed).toBe(true);
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
