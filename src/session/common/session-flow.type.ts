import type { CallToolResult } from '@modelcontextprotocol/server';

import type { SessionMode } from './session-mode.type';

export type SessionFlowState = {
  readonly sessionId: string;
  readonly prompt?: string;
  readonly nativeSessionId?: string;
  readonly startSessionId?: string;
  readonly mode: SessionMode;
};

export type SessionFlowResult = {
  readonly response: CallToolResult;
  readonly responseText: string;
  readonly nativeSessionId?: string;
  readonly sessionMode: SessionMode;
  readonly wasCancelled: boolean;
  readonly wasStopped?: boolean;
  readonly hasDroppedStartFlag?: boolean;
};
