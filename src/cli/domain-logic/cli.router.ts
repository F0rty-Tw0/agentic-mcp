import process from 'node:process';

import { printResult } from './cli-output';
import type { AskToolArgs } from '../../ask';
import type { AskAllToolArgs } from '../../ask-all';
import type { CliSubcommand } from '../common';
import { parseAskAllArgs, parseAskArgs } from '../utils/cli-arg-parser.util';
import { renderCliProgress } from '../utils/cli-progress-renderer.util';
import { callCliTool } from '../utils/in-process-mcp-client.util';
import type { CallCliToolInput } from '../utils/in-process-mcp-client.util';
import { parseSubcommand } from '../utils/subcommand.util';

const buildToolArgs = (subcommand: CliSubcommand, remainingArgs: readonly string[]): AskToolArgs | AskAllToolArgs => {
  if (subcommand === 'ask_all') {
    const result = parseAskAllArgs(remainingArgs);

    return result;
  }

  if (subcommand.startsWith('ask_')) {
    const result = parseAskArgs(remainingArgs);

    return result;
  }

  return {};
};

const buildCallCliToolInput = (
  subcommand: CliSubcommand,
  args: AskToolArgs | AskAllToolArgs,
  configPath?: string
): CallCliToolInput => {
  if ('stream_live' in args && args.stream_live === true) {
    const result: CallCliToolInput = {
      toolName: subcommand,
      args,
      configPath,
      onProgress: renderCliProgress,
    };

    return result;
  }

  const result: CallCliToolInput = {
    toolName: subcommand,
    args,
    configPath,
  };

  return result;
};

export const runCli = async (
  subcommand: CliSubcommand,
  remainingArgs: readonly string[],
  configPath?: string
): Promise<void> => {
  const parsedSubcommand = parseSubcommand(subcommand);

  if (!parsedSubcommand) {
    process.stderr.write(`Unknown command: ${subcommand}\n`);
    process.exitCode = 1;

    return;
  }

  const args = buildToolArgs(parsedSubcommand, remainingArgs);
  const callCliToolInput = buildCallCliToolInput(parsedSubcommand, args, configPath);
  const result = await callCliTool(callCliToolInput);

  printResult(result);
};
