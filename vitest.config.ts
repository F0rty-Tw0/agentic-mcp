import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { defineConfig } from 'vitest/config';

// Keeps every test run off the user's real metrics file and its cross-process lock.
const testMetricsPath = path.join(os.tmpdir(), `agentic-mcp-vitest-${process.pid}`, 'provider-metrics.json');

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    env: { AGENTIC_MCP_METRICS_PATH: testMetricsPath },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/**/index.ts',
        'src/**/stubs/**',
        'src/**/common/index.ts',
        'src/types/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
