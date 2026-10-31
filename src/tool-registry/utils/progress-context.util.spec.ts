import type { ServerNotification } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';

import { toProgressContext } from './progress-context.util';
import { makeToolRequestContext } from '../test/utils/tool-registry.spec.util';

describe('toProgressContext', () => {
  describe('GIVEN a v2 tool request context', () => {
    describe('WHEN it is adapted', () => {
      it('THEN the request id becomes requestId', () => {
        const ctx = makeToolRequestContext();
        const progressContext = toProgressContext(ctx);

        expect(progressContext.requestId).toBe('request-1');
      });

      it('THEN the request _meta carries the progress token through', () => {
        const ctx = makeToolRequestContext();
        const { _meta: requestMeta } = toProgressContext(ctx);

        expect(requestMeta?.progressToken).toBe('progress-token-1');
      });

      it('THEN the abort signal is the request signal', () => {
        const ctx = makeToolRequestContext();
        const progressContext = toProgressContext(ctx);

        expect(progressContext.signal).toBe(ctx.mcpReq.signal);
      });

      it('THEN sendNotification forwards the notification to the request notify', async () => {
        const ctx = makeToolRequestContext();
        const progressContext = toProgressContext(ctx);
        const params = { progressToken: 'progress-token-1', progress: 1 };
        const notification: ServerNotification = { method: 'notifications/progress', params };

        await progressContext.sendNotification(notification);

        expect(ctx.mcpReq.notify).toHaveBeenCalledExactlyOnceWith(notification);
      });
    });
  });
});
