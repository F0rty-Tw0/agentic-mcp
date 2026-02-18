#!/usr/bin/env node

import process from 'node:process';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createServer } from './server.ts';

async function main(): Promise<void> {
  const configIndex = process.argv.indexOf('--config');
  const configPath =
    configIndex !== -1 && configIndex + 1 < process.argv.length
      ? process.argv[configIndex + 1]
      : undefined;

  const server = await createServer(configPath ? { configPath } : undefined);
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';

  process.stderr.write(`agentic-mcp: ${message}\n`);
  process.exit(1);
});
