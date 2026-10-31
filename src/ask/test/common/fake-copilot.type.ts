import type { CallToolResult } from '@modelcontextprotocol/server';

export type AskedTurn = {
  readonly result: CallToolResult;
  readonly runs: string[][];
};

export type FakeCopilotRunLog = {
  readonly dir: string;
  readonly path: string;
};
