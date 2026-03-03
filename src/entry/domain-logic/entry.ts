import process from 'node:process';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createServer } from '../../server';
import { runSetup } from '../../setup';
import { APP_VERSION } from '../../shared';
import { HELP_TEXT } from '../common';
import { parseConfigPath } from '../utils';

export const entry = async (): Promise<void> => {
  const args = process.argv.slice(2);

  if (args.includes('--version')) {
    process.stdout.write(`${APP_VERSION}\n`);
    process.exit(0);

    return;
  }

  if (args.includes('--help')) {
    process.stdout.write(HELP_TEXT);
    process.exit(0);

    return;
  }

  if (args[0] === 'setup') {
    await runSetup(args.slice(1));

    return;
  }

  const configPath = parseConfigPath(process.argv);
  const options = configPath ? { configPath } : undefined;
  const server = await createServer(options);
  const transport = new StdioServerTransport();

  await server.connect(transport);
};
