import { describe, expect, it } from 'vitest';

import { buildCommandFailure } from './ask-command';
import type { ExecutionResult, ExecutionTimeoutCause } from '../../shared/command-execution/common';
import { ASK_SUCCESS_EXECUTION_RESULT_STUB } from '../test/stubs/ask-execution-result.stub';
import { ASK_RESOLVED_PROVIDER_ENTRY_STUB } from '../test/stubs/ask-resolved-provider-entry.stub';

const buildTimedOutResult = (timeoutCause: ExecutionTimeoutCause): ExecutionResult => {
  const result: ExecutionResult = {
    ...ASK_SUCCESS_EXECUTION_RESULT_STUB,
    exitCode: null,
    timedOut: true,
    timeoutCause,
  };

  return result;
};

const readFailureText = async (result: ExecutionResult): Promise<string | undefined> => {
  const error = await buildCommandFailure(ASK_RESOLVED_PROVIDER_ENTRY_STUB, { prompt: 'hello' }, {}, result);
  const [firstContent] = error.toMcpResponse().content;
  const text = firstContent?.text;

  return text;
};

describe('FEATURE: buildCommandFailure timeout wording', () => {
  describe('GIVEN a run killed by the idle limit', () => {
    it('WHEN building the failure THEN the error says the process gave no output for that many seconds', async () => {
      const timeoutCause: ExecutionTimeoutCause = { kind: 'idle', limitMs: 600_000 };
      const text = await readFailureText(buildTimedOutResult(timeoutCause));

      expect(text).toBe('test command failed Process killed after no output for 600 s (provider idleTimeout).');
    });
  });

  describe('GIVEN a run killed by the wall-clock limit', () => {
    it('WHEN building the failure THEN the error says the run timed out after that many seconds', async () => {
      const timeoutCause: ExecutionTimeoutCause = { kind: 'wall-clock', limitMs: 3_600_000 };
      const text = await readFailureText(buildTimedOutResult(timeoutCause));

      expect(text).toBe('test command failed Process timed out after 3600 s (provider timeout).');
    });
  });
});
