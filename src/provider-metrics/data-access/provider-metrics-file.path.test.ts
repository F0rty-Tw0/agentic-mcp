import os from 'node:os';

import { describe, expect, it } from 'vitest';

import { resolveProviderMetricsFilePath } from './provider-metrics-file.path';

// Integration runs spawn real servers that record metrics, so their config must point off the user's real file.
describe('FEATURE: integration metrics path', () => {
  describe('GIVEN the integration vitest env', () => {
    describe('WHEN the metrics path is resolved', () => {
      it('THEN the path sits in the OS temp dir', () => {
        const result = resolveProviderMetricsFilePath();
        const inTempDir = result.startsWith(os.tmpdir());

        expect(inTempDir).toBe(true);
      });

      it('THEN the path sits in the per-run vitest dir', () => {
        const result = resolveProviderMetricsFilePath();

        expect(result).toMatch(/agentic-mcp-vitest-\d+/);
      });
    });
  });
});
