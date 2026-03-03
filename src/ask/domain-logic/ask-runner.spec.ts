import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it, vi } from 'vitest';

import type { ResolvedProviderEntry } from '../../shared';
import { TEST_PROVIDER_CONFIG_STUB } from '../../shared';
import { buildExecution, buildFailureExecution } from '../utils/ask-runner-response.util';

vi.mock('../../session', () => ({
  extractNativeSessionId: vi.fn((_name: string, stdout: string) => {
    const match = /session-(.+)/.exec(stdout);

    return match?.[1];
  }),
}));

vi.mock('../../shared/command-execution/utils/platform.util', () => ({
  stripAnsi: vi.fn((s: string) => s),
}));

const textResponse = (text: string): CallToolResult => ({
  content: [{ type: 'text', text }],
});

const imageResponse = (): CallToolResult => ({
  content: [{ type: 'image', data: 'abc', mimeType: 'image/png' }],
});

const emptyResponse = (): CallToolResult => ({
  content: [],
});

const stubContext = (overrides?: Partial<ResolvedProviderEntry>): ResolvedProviderEntry => ({
  name: 'test-provider',
  binaryPath: '/usr/bin/test',
  config: TEST_PROVIDER_CONFIG_STUB,
  ...overrides,
});

describe('buildFailureExecution', () => {
  it('GIVEN a response and wasCancelled=false WHEN building THEN returns failure with sessionMode none', () => {
    const response = textResponse('error');

    const result = buildFailureExecution(response, false);

    expect(result).toStrictEqual({
      response,
      sessionMode: 'none',
      responseText: '',
      wasCancelled: false,
    });
  });

  it('GIVEN wasCancelled=true WHEN building THEN propagates cancellation flag', () => {
    const response = textResponse('cancelled');

    const result = buildFailureExecution(response, true);

    expect(result.wasCancelled).toBe(true);
  });

  it('GIVEN any response WHEN building THEN responseText is always empty', () => {
    const response = textResponse('some output');

    const result = buildFailureExecution(response, false);

    expect(result.responseText).toBe('');
  });
});

describe('buildExecution', () => {
  it('GIVEN text content WHEN building THEN extracts text into responseText', () => {
    const response = textResponse('hello world');

    const result = buildExecution(response, '', stubContext());

    expect(result.responseText).toBe('hello world');
  });

  it('GIVEN non-text content WHEN building THEN responseText is empty', () => {
    const response = imageResponse();

    const result = buildExecution(response, '', stubContext());

    expect(result.responseText).toBe('');
  });

  it('GIVEN empty content array WHEN building THEN responseText is empty', () => {
    const response = emptyResponse();

    const result = buildExecution(response, '', stubContext());

    expect(result.responseText).toBe('');
  });

  it('GIVEN stdout with session id WHEN building THEN extracts nativeSessionId', () => {
    const response = textResponse('ok');

    const result = buildExecution(response, 'session-abc123', stubContext());

    expect(result.nativeSessionId).toBe('abc123');
  });

  it('GIVEN stdout without session id WHEN building THEN nativeSessionId is undefined', () => {
    const response = textResponse('ok');

    const result = buildExecution(response, 'no-match-here', stubContext());

    expect(result.nativeSessionId).toBeUndefined();
  });

  it('GIVEN any inputs WHEN building THEN wasCancelled is always false', () => {
    const response = textResponse('ok');

    const result = buildExecution(response, '', stubContext());

    expect(result.wasCancelled).toBe(false);
  });

  it('GIVEN any inputs WHEN building THEN sessionMode is always none', () => {
    const response = textResponse('ok');

    const result = buildExecution(response, '', stubContext());

    expect(result.sessionMode).toBe('none');
  });

  it('GIVEN a response WHEN building THEN preserves the original response object', () => {
    const response = textResponse('preserved');

    const result = buildExecution(response, '', stubContext());

    expect(result.response).toBe(response);
  });
});
