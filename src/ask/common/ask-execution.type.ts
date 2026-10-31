import type { CallToolResult } from '@modelcontextprotocol/server';

import type { SessionMode } from '../../session/common';

export type AskExecution = {
  readonly response: CallToolResult;
  readonly sessionMode: SessionMode;
  readonly responseText: string;
  readonly nativeSessionId?: string;
  readonly wasCancelled: boolean;
  readonly wasStopped?: boolean;
};
