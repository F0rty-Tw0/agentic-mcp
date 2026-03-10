import { describe, expect, it } from 'vitest';

import { SESSION_STORE, appendSessionMetadata, buildSessionFlowState, executeSessionFlow, handleSessions } from '.';

describe('session module exports', () => {
  it('GIVEN session module WHEN importing public API THEN exposes session store and ask session helpers', () => {
    expect(SESSION_STORE).toBeDefined();
    expect(appendSessionMetadata).toBeTypeOf('function');
    expect(buildSessionFlowState).toBeTypeOf('function');
    expect(executeSessionFlow).toBeTypeOf('function');
    expect(handleSessions).toBeTypeOf('function');
  });
});
