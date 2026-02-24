import { describe, expect, it } from 'vitest';

import { ASK_STREAM_EVENT_SCHEMA } from './stream-event.types';
import type { AskStreamEvent } from './stream-event.types';

describe('stream event types', () => {
  it('GIVEN a stream event WHEN serializing THEN shape is stable and includes required metadata', () => {
    const event: AskStreamEvent = {
      schema: ASK_STREAM_EVENT_SCHEMA,
      type: 'chunk',
      streamId: 'ask-test-1',
      sequence: 1,
      channel: 'stdout',
      chunk: 'hello',
      timestamp: '2026-02-21T00:00:00.000Z',
    };

    expect(event.schema).toBe('agentic-mcp.ask.stream.v1');
  });
});
