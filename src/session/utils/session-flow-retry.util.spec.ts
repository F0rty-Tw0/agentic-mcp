import type { CallToolResult, TextContent } from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';

import { canFallBackToTier1 } from './session-flow-retry.util';
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
const SUCCESS_RESPONSE: CallToolResult = { content: [] };

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
