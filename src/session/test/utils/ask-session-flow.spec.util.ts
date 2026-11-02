import type { CallToolResult, TextContent } from '@modelcontextprotocol/server';

import type { AskExecution, AskToolArgs } from '../../../ask/common';
import type { ProviderConfig, ResolvedProviderEntry } from '../../../shared/provider/common';
import type { SessionFlowState } from '../../common';

export const createCallToolResult = (overrides: Partial<CallToolResult> = {}): CallToolResult => {
  const content: TextContent[] = [{ type: 'text', text: 'response text' }];
  const result: CallToolResult = {
    content,
    isError: false,
    ...overrides,
  };

  return result;
};

export const createAskExecution = (overrides: Partial<AskExecution> = {}): AskExecution => {
  const result: AskExecution = {
    response: createCallToolResult(),
    sessionMode: 'none',
    responseText: 'response text',
    nativeSessionId: undefined,
    wasCancelled: false,
    ...overrides,
  };

  return result;
};

export const createResolvedProviderEntry = (overrides: Partial<ResolvedProviderEntry> = {}): ResolvedProviderEntry => {
  const ask = { args: [] };
  const commands = {
    ask,
  };
  const input = { method: 'flag' } as const;
  const config: ProviderConfig = {
    enabled: true,
    description: 'Test provider',
    command: 'test-cli',
    timeout: 30000,
    env: {},
    outputFormat: 'text',
    commands,
    input,
  };
  const result: ResolvedProviderEntry = {
    name: 'test-provider',
    binaryPath: '/usr/bin/test-cli',
    config,
    ...overrides,
  };

  return result;
};

export const createAskToolArgs = (overrides: Partial<AskToolArgs> = {}): AskToolArgs => {
  const result: AskToolArgs = {
    prompt: 'Hello world',
    session_id: 'session-abc',
    ...overrides,
  };

  return result;
};

export const createSessionFlowState = (overrides: Partial<SessionFlowState> = {}): SessionFlowState => {
  const result: SessionFlowState = {
    sessionId: 'session-abc',
    prompt: 'Hello world',
    nativeSessionId: undefined,
    mode: 'tier1-prepend',
    ...overrides,
  };

  return result;
};
