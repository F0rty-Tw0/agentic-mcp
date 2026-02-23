import process from 'node:process';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createServer } from '../../server/create-server.ts';
import { APP_VERSION } from '../../shared/common/index.ts';
import { HELP_TEXT } from '../common/index.ts';
import { parseConfigPath } from '../utils/index.ts';

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
    const { runSetup } = await import('../../setup/setup-cli.ts');

    await runSetup(args.slice(1));

    return;
  }

  const configPath = parseConfigPath(process.argv);
  const options = configPath ? { configPath } : undefined;
  const server = await createServer(options);
  const transport = new StdioServerTransport();

  await server.connect(transport);
};
