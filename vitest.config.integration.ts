import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { defineConfig } from 'vitest/config';

// Mirrors vitest.config.ts; importing it from here trips Vite's native config loader on the extensionless path.
const testMetricsPath = path.join(os.tmpdir(), `agentic-mcp-vitest-${process.pid}`, 'provider-metrics.json');

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    env: { AGENTIC_MCP_METRICS_PATH: testMetricsPath },
  },
});
