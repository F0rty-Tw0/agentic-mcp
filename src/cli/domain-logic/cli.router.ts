import process from 'node:process';

import { printResult } from './cli-output';
import { parseAskAllArgs, parseAskArgs } from '../utils/cli-arg-parser.util';
import { renderCliProgress } from '../utils/cli-progress-renderer.util';
import { callCliTool } from '../utils/in-process-mcp-client.util';
import type { CallCliToolInput } from '../utils/in-process-mcp-client.util';
import { parseSubcommand } from '../utils/subcommand.util';
import type { CliSubcommand } from '../utils/subcommand.util';

const buildToolArgs = (
  subcommand: CliSubcommand,
  remainingArgs: readonly string[]
): Readonly<Record<string, unknown>> => {
  if (subcommand === 'ask_all') {
    const result = parseAskAllArgs(remainingArgs);

    return result;
  }

  if (subcommand.startsWith('ask_')) {
    const result = parseAskArgs(remainingArgs);

    return result;
  }

  const result: Readonly<Record<string, unknown>> = {};

  return result;
};
const buildCallCliToolInput = (
  subcommand: CliSubcommand,
  args: Readonly<Record<string, unknown>>,
  configPath?: string
): CallCliToolInput => {
  if (args.stream_live === true) {
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
  subcommand: string,
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
