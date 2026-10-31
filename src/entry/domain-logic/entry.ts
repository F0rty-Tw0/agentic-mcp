import process from 'node:process';

import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { isCliSubcommand, runCli } from '../../cli';
import { runProve } from '../../prove';
import { runSetup } from '../../setup';
import { APP_VERSION } from '../../shared';
import { HELP_TEXT } from '../common';
import { parseConfigPath } from '../utils';
import { registerGracefulShutdown } from './graceful-shutdown';
import { createServerFactory } from './server-factory';
import type { ConfigPathOptions } from '../../shared/provider/common';

const reportStdioError = (error: Error): void => {
  process.stderr.write(`agentic-mcp: ${error.message}\n`);
};

const startServer = async (configPath?: string): Promise<void> => {
  const configPathOptions: ConfigPathOptions = { configPath };
  const options = configPath ? configPathOptions : undefined;
  const serverFactory = await createServerFactory(options);
  const stdioServer = serveStdio(serverFactory, { onerror: reportStdioError });

  registerGracefulShutdown(async () => {
    await stdioServer.close();
  });
};

export const entry = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const hasVersionFlag = args.includes('--version');
  const hasHelpFlag = args.includes('--help');

  if (hasVersionFlag) {
    process.stdout.write(`${APP_VERSION}\n`);

    return process.exit(0);
  }

  if (hasHelpFlag) {
    process.stdout.write(HELP_TEXT);

    return process.exit(0);
  }

  const [firstArg = ''] = args;
  const remainingArgs = args.slice(1);

  if (firstArg === 'setup') return runSetup(remainingArgs);

  if (firstArg === 'init') return runSetup(['--minimal', ...remainingArgs]);

  if (firstArg === 'prove') {
    const configPath = parseConfigPath(process.argv);

    return runProve({ args: remainingArgs, configPath });
  }

  const isCliCommand = isCliSubcommand(firstArg);

  if (isCliCommand) {
    const configPath = parseConfigPath(process.argv);

    return runCli(firstArg, remainingArgs, configPath);
  }

  const configPath = parseConfigPath(process.argv);

  await startServer(configPath);
};
