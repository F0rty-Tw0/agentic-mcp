#!/usr/bin/env node
import { entry } from './entry/domain-logic/entry';

entry().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';

  process.stderr.write(`agentic-mcp: ${message}\n`);
  process.exit(1);
});
