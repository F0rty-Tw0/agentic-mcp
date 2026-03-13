import process from 'node:process';

import { writeAskAllReport } from './ask-all-report.writer';
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

type CliToolArgs = AskToolArgs | AskAllToolArgs | ReviewToolArgs;

type AskAllCliOptions = Readonly<{
  reportPath?: string;
  sanitizedArgs: readonly string[];
}>;

type CliExecutionPlan = Readonly<{
  args: CliToolArgs;
  reportPath?: string;
}>;

const buildMissingReportPathMessage = (): string => 'ask_all requires a file path after --report.';

const buildDuplicateReportPathMessage = (): string => 'ask_all accepts --report only once.';

const extractAskAllCliOptions = (remainingArgs: readonly string[]): AskAllCliOptions => {
  const sanitizedArgs: string[] = [];
  let reportPath: string | undefined;

  for (let i = 0; i < remainingArgs.length; i += 1) {
    const arg = remainingArgs[i];

    if (arg !== '--report') {
      if (arg != null) sanitizedArgs.push(arg);

      continue;
    }

    if (reportPath != null) {
      throw new ValidationError(buildDuplicateReportPathMessage());
    }

    const nextArg = remainingArgs[i + 1];

    if (nextArg == null || nextArg.startsWith('--')) {
      throw new ValidationError(buildMissingReportPathMessage());
    }

    reportPath = nextArg;
    i += 1;
  }

  const result: AskAllCliOptions = {
    reportPath,
    sanitizedArgs,
  };

  return result;
};

const buildCliExecutionPlan = (subcommand: CliSubcommand, remainingArgs: readonly string[]): CliExecutionPlan => {
  if (subcommand === 'ask_all') {
    const askAllCliOptions = extractAskAllCliOptions(remainingArgs);
    const result: CliExecutionPlan = {
      args: parseAskAllArgs(askAllCliOptions.sanitizedArgs),
      reportPath: askAllCliOptions.reportPath,
    };

    return result;
  }

  if (subcommand.startsWith('ask_')) {
    const result: CliExecutionPlan = {
      args: parseAskArgs(remainingArgs),
    };

    return result;
  }

  if (subcommand.startsWith('review_')) {
    const result: CliExecutionPlan = {
      args: parseReviewArgs(remainingArgs),
    };

    return result;
  }

  const result: CliExecutionPlan = {
    args: {},
  };

  return result;
};

const buildCallCliToolInput = (subcommand: CliSubcommand, args: CliToolArgs, configPath?: string): CallCliToolInput => {
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

const writeReportSavedMessage = (reportPath: string, isError: boolean): void => {
  const message = `Report saved to ${reportPath}\n`;

  if (isError) {
    process.stderr.write(message);

    return;
  }

  process.stdout.write(message);
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
    const cliExecutionPlan = buildCliExecutionPlan(parsedSubcommand, remainingArgs);
    const callCliToolInput = buildCallCliToolInput(parsedSubcommand, cliExecutionPlan.args, configPath);
    const result = await callCliTool(callCliToolInput);

    if (cliExecutionPlan.reportPath != null) {
      await writeAskAllReport({ reportPath: cliExecutionPlan.reportPath, result });
      printResult(result, { includeStructuredContent: false });
      writeReportSavedMessage(cliExecutionPlan.reportPath, result.isError === true);

      return;
    }

    printResult(result);
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      writeValidationError(error);

      return;
    }

    throw error;
  }
};
