import type { CallToolResult, TextContent } from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';

import { canFallBackToTier1, canRetryWithoutStartFlag } from './session-flow-retry.util';
import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { SessionFlowResult, SessionFlowState } from '../common';

const createExecution = (overrides: Partial<SessionFlowResult> = {}): SessionFlowResult => {
  const content: TextContent[] = [{ type: 'text', text: 'failed' }];
  const response: CallToolResult = { content, isError: true };
  const result: SessionFlowResult = {
    response,
    responseText: '',
    sessionMode: 'tier2-native',
    wasCancelled: false,
    ...overrides,
  };

  return result;
};

const TIER2_STATE: SessionFlowState = { sessionId: 'session-a', nativeSessionId: 'native-a', mode: 'tier2-native' };
const TIER1_STATE: SessionFlowState = { sessionId: 'session-a', mode: 'tier1-prepend' };
const START_STATE: SessionFlowState = { sessionId: 'session-a', startSessionId: 'start-a', mode: 'tier1-prepend' };
const SUCCESS_RESPONSE: CallToolResult = { content: [] };
const START_FLAG = '--session-id';

const createFailedExecution = (text: string): SessionFlowResult => {
  const content: TextContent[] = [{ type: 'text', text }];
  const response: CallToolResult = { content, isError: true };
  const result = createExecution({ response });

  return result;
};

const REJECTED_EXECUTION = createFailedExecution(
  "copilot command failed Exit code: 2. Stderr: error: unknown option '--session-id=start-a'\n"
);

const createAbortedExtra = (): ProgressContext => {
  const controller = new AbortController();

  controller.abort();

  const extra: ProgressContext = { sendNotification: vi.fn(), signal: controller.signal };

  return extra;
};

describe('FEATURE: canFallBackToTier1', () => {
  it('GIVEN a failed tier2 run WHEN checked THEN it falls back', () => {
    expect(canFallBackToTier1(createExecution(), TIER2_STATE)).toBe(true);
  });

  it('GIVEN a successful tier2 run WHEN checked THEN it does not fall back', () => {
    const execution = createExecution({ response: SUCCESS_RESPONSE });

    expect(canFallBackToTier1(execution, TIER2_STATE)).toBe(false);
  });

  it('GIVEN a failed tier1 run WHEN checked THEN it does not fall back', () => {
    expect(canFallBackToTier1(createExecution(), TIER1_STATE)).toBe(false);
  });

  it('GIVEN a cancelled tier2 run WHEN checked THEN it does not fall back', () => {
    const execution = createExecution({ wasCancelled: true });

    expect(canFallBackToTier1(execution, TIER2_STATE)).toBe(false);
  });

  it('GIVEN a stopped tier2 run WHEN checked THEN it does not fall back', () => {
    const execution = createExecution({ wasStopped: true });

    expect(canFallBackToTier1(execution, TIER2_STATE)).toBe(false);
  });

  it('GIVEN an aborted request WHEN checked THEN it does not fall back', () => {
    expect(canFallBackToTier1(createExecution(), TIER2_STATE, createAbortedExtra())).toBe(false);
  });
});

describe('FEATURE: canRetryWithoutStartFlag', () => {
  it('GIVEN a run that passed a start id and the CLI rejected the flag WHEN checked THEN it retries', () => {
    expect(canRetryWithoutStartFlag(REJECTED_EXECUTION, START_STATE, START_FLAG)).toBe(true);
  });

  it('GIVEN a run that passed a start id and failed for another reason WHEN checked THEN it does not retry', () => {
    expect(canRetryWithoutStartFlag(createExecution(), START_STATE, START_FLAG)).toBe(false);
  });

  it('GIVEN a run that passed a start id and the CLI rejected another option WHEN checked THEN it does not retry', () => {
    const execution = createFailedExecution("error: unknown option '--yolo-mode'");

    expect(canRetryWithoutStartFlag(execution, START_STATE, START_FLAG)).toBe(false);
  });

  it('GIVEN a rejection naming the flag and an unknown-option line elsewhere WHEN checked THEN it does not retry', () => {
    const execution = createFailedExecution("argv: --session-id=start-a\nerror: unknown option '--yolo-mode'");

    expect(canRetryWithoutStartFlag(execution, START_STATE, START_FLAG)).toBe(false);
  });

  it('GIVEN a rejected run and no configured start flag WHEN checked THEN it does not retry', () => {
    expect(canRetryWithoutStartFlag(REJECTED_EXECUTION, START_STATE, undefined)).toBe(false);
  });

  it('GIVEN a successful run that passed a start id WHEN checked THEN it does not retry', () => {
    const execution = createExecution({ response: SUCCESS_RESPONSE });

    expect(canRetryWithoutStartFlag(execution, START_STATE, START_FLAG)).toBe(false);
  });

  it('GIVEN a rejected run without a start id WHEN checked THEN it does not retry', () => {
    expect(canRetryWithoutStartFlag(REJECTED_EXECUTION, TIER1_STATE, START_FLAG)).toBe(false);
  });

  it('GIVEN a cancelled rejected run that passed a start id WHEN checked THEN it does not retry', () => {
    const execution: SessionFlowResult = { ...REJECTED_EXECUTION, wasCancelled: true };

    expect(canRetryWithoutStartFlag(execution, START_STATE, START_FLAG)).toBe(false);
  });

  it('GIVEN a stopped rejected run that passed a start id WHEN checked THEN it does not retry', () => {
    const execution: SessionFlowResult = { ...REJECTED_EXECUTION, wasStopped: true };

    expect(canRetryWithoutStartFlag(execution, START_STATE, START_FLAG)).toBe(false);
  });

  it('GIVEN an aborted request WHEN checked THEN it does not retry', () => {
    expect(canRetryWithoutStartFlag(REJECTED_EXECUTION, START_STATE, START_FLAG, createAbortedExtra())).toBe(false);
  });
});
