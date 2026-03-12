import process from 'node:process';

import { printResult } from './cli-output';
import type { AskToolArgs, ReviewToolArgs } from '../../ask';
import type { AskAllToolArgs } from '../../ask-all';
import { ValidationError } from '../../shared';
import type { CallCliToolInput, CliSubcommand } from '../common';
import { parseAskAllArgs, parseAskArgs } from '../utils/cli-arg-parser.util';
import { renderCliProgress } from '../utils/cli-progress-renderer.util';
import { callCliTool } from '../utils/in-process-mcp-client.util';
import { parseReviewArgs } from '../utils/review-arg-parser.util';
import { parseSubcommand } from '../utils/subcommand.util';

const buildToolArgs = (
  subcommand: CliSubcommand,
  remainingArgs: readonly string[]
): AskToolArgs | AskAllToolArgs | ReviewToolArgs => {
  if (subcommand === 'ask_all') {
    return parseAskAllArgs(remainingArgs);
  }

  if (subcommand.startsWith('ask_')) {
    return parseAskArgs(remainingArgs);
  }

  if (subcommand.startsWith('review_')) {
    return parseReviewArgs(remainingArgs);
  }

  return {};
};

const buildCallCliToolInput = (
  subcommand: CliSubcommand,
  args: AskToolArgs | AskAllToolArgs | ReviewToolArgs,
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

const writeValidationError = (error: ValidationError): void => {
  process.stderr.write(`Validation error: ${error.message}\n`);
  process.exitCode = 1;
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

  try {
    const args = buildToolArgs(parsedSubcommand, remainingArgs);
    const callCliToolInput = buildCallCliToolInput(parsedSubcommand, args, configPath);
    const result = await callCliTool(callCliToolInput);

    printResult(result);
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      writeValidationError(error);

      return;
    }

    throw error;
  }
};
