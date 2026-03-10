import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { SessionMode } from '../../session';

export type AskExecution = Readonly<{
  response: CallToolResult;
  sessionMode: SessionMode;
  responseText: string;
  nativeSessionId?: string;
  wasCancelled: boolean;
}>;
