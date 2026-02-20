#!/usr/bin/env node
import process from 'node:process';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createServer } from './server.ts';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0-dev';

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);

  if (args.includes('--version')) {
    process.stdout.write(`${APP_VERSION}\n`);
    process.exit(0);

    return;
  }

  if (args.includes('--help')) {
    process.stdout.write(
      [
        'Usage: agentic-mcp [options]',
        '',
        'Options:',
        '  --config <path>  Path to providers config file',
        '  --version        Print version and exit',
        '  --help           Print this help message and exit',
        '',
      ].join('\n'),
    );
    process.exit(0);

    return;
  }

  const configIndex = process.argv.indexOf('--config');
  const configPath =
    configIndex !== -1 && configIndex + 1 < process.argv.length ? process.argv[configIndex + 1] : undefined;

  const options = configPath ? { configPath } : undefined;
  const server = await createServer(options);
  const transport = new StdioServerTransport();

  await server.connect(transport);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';

  process.stderr.write(`agentic-mcp: ${message}\n`);
  process.exit(1);
});
