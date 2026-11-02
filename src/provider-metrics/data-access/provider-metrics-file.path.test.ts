import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveProviderMetricsFilePath } from './provider-metrics-file.path';

// Integration runs spawn real servers that record metrics, so their config must point off the user's real file.
describe('FEATURE: integration metrics path', () => {
  describe('GIVEN the integration vitest env', () => {
    describe('WHEN the metrics path is resolved', () => {
      it('THEN the path sits directly in a per-run agentic-mcp-vitest-<pid> dir', () => {
        const result = resolveProviderMetricsFilePath();
        const metricsDirName = path.basename(path.dirname(result));

        expect(metricsDirName).toMatch(/^agentic-mcp-vitest-\d+$/);
      });

      it('THEN the per-run dir sits directly in the OS temp dir', () => {
        const result = resolveProviderMetricsFilePath();
        const metricsParentDir = path.dirname(path.dirname(result));

        expect(metricsParentDir).toBe(os.tmpdir());
      });
    });
  });
});
