import {
  FLAG_AUTO_MODE,
  FLAG_EFFORT,
  FLAG_FILE,
  FLAG_MAX_BUDGET,
  FLAG_MODEL,
  FLAG_SANDBOX,
  FLAG_SYSTEM_PROMPT,
  FLAG_WORKING_DIR,
} from '../../ask/common';
import type { AskToolArgs, BuiltArgs, ReviewToolArgs } from '../../ask/common';
import { getFlag, getReviewCommand, resolveAskCommand } from '../../ask/utils';
import type { CommandDef, FlagValue, ProviderConfig } from '../../shared';
import { ValidationError } from '../../shared';

const REVIEW_BASE_FLAG_KEY = 'base';
const REVIEW_COMMIT_FLAG_KEY = 'commit';
const REVIEW_UNCOMMITTED_FLAG_KEY = 'uncommitted';

const resolveFlagToArgs = (flagValue?: FlagValue, argValue?: string): string[] => {
  if (!flagValue) return [];

  if (typeof flagValue === 'string') {
    return argValue ? [flagValue, argValue] : [flagValue];
  }

  if (Array.isArray(flagValue)) return [...flagValue];

  if (!argValue) return [];

  if (!flagValue.values.includes(argValue)) {
    throw new ValidationError(
      `Invalid value "${argValue}" for flag "${flagValue.flag}". Allowed: ${flagValue.values.join(', ')}`
    );
  }

  return [flagValue.flag, argValue];
};

const appendValueFlag = (
  cliArgs: string[],
  commandDef: CommandDef,
  flagKey: string,
  value?: string | boolean
): void => {
  if (!value) return;

  const flag = getFlag(commandDef, flagKey);

  if (!flag) return;

  const argValue = typeof value === 'string' ? value : undefined;
  const flagArgs = resolveFlagToArgs(flag, argValue);

  cliArgs.push(...flagArgs);
};

const appendFileFlags = (cliArgs: string[], askCmd: CommandDef, files?: readonly string[]): void => {
  if (!files?.length) return;

  const flag = getFlag(askCmd, FLAG_FILE);

  if (!flag) return;

  if (typeof flag !== 'string') {
    throw new ValidationError(
      `File flag must be a simple string flag, got ${Array.isArray(flag) ? 'array' : 'object'}`
    );
  }

  for (const file of files) {
    cliArgs.push(flag, file);
  }
};

const appendSandboxFlag = (cliArgs: string[], askCmd: CommandDef, sandbox?: string | boolean): void => {
  if (!sandbox) return;

  const flag = getFlag(askCmd, FLAG_SANDBOX);

  if (!flag) return;

  const sandboxValue = typeof sandbox === 'string' ? sandbox : undefined;
  const flagArgs = resolveFlagToArgs(flag, sandboxValue);

  cliArgs.push(...flagArgs);
};

const appendOptionalFlags = (cliArgs: string[], askCmd: CommandDef, args: AskToolArgs): void => {
  appendValueFlag(cliArgs, askCmd, FLAG_MODEL, args.model);
  appendValueFlag(cliArgs, askCmd, FLAG_WORKING_DIR, args.working_directory);
  appendFileFlags(cliArgs, askCmd, args.files);
  appendValueFlag(cliArgs, askCmd, FLAG_AUTO_MODE, args.auto_mode);
  appendSandboxFlag(cliArgs, askCmd, args.sandbox);
  appendValueFlag(cliArgs, askCmd, FLAG_EFFORT, args.effort);
  appendValueFlag(cliArgs, askCmd, FLAG_MAX_BUDGET, args.max_budget);
  appendValueFlag(cliArgs, askCmd, FLAG_SYSTEM_PROMPT, args.system_prompt);
};

const appendRequiredReviewFlag = (cliArgs: string[], reviewCmd: CommandDef, flagKey: string, value?: string): void => {
  const flag = getFlag(reviewCmd, flagKey);

  if (flag == null) {
    throw new ValidationError(`Provider review command missing required "${flagKey}" flag`);
  }

  const flagArgs = resolveFlagToArgs(flag, value);

  cliArgs.push(...flagArgs);
};

const appendReviewScopeArgs = (cliArgs: string[], reviewCmd: CommandDef, args: ReviewToolArgs): void => {
  if (args.scope === 'uncommitted') {
    appendRequiredReviewFlag(cliArgs, reviewCmd, REVIEW_UNCOMMITTED_FLAG_KEY);

    return;
  }

  if (args.scope === 'commit') {
    if (args.commit == null) throw new ValidationError('commit is required when scope=commit');

    appendRequiredReviewFlag(cliArgs, reviewCmd, REVIEW_COMMIT_FLAG_KEY, args.commit);

    return;
  }

  if (args.base == null) throw new ValidationError('base is required when scope=range');

  appendRequiredReviewFlag(cliArgs, reviewCmd, REVIEW_BASE_FLAG_KEY, args.base);
};

export const buildArgArray = (config: ProviderConfig, args: AskToolArgs): BuiltArgs => {
  const cliArgs: string[] = [];
  let stdinInput: string | undefined;

  if (!args.prompt) throw new ValidationError('Missing required "prompt" argument');

  const { command: askCmd, outputFormat } = resolveAskCommand(config, args.stream_live === true);

  if (askCmd.args?.length) {
    cliArgs.push(...askCmd.args);
  }

  if (config.input.method === 'stdin') {
    stdinInput = args.prompt;
  } else {
    cliArgs.push(args.prompt);
  }

  appendOptionalFlags(cliArgs, askCmd, args);

  if (askCmd.trailingArgs?.length) {
    cliArgs.push(...askCmd.trailingArgs);
  }

  const builtArgs: BuiltArgs = { args: cliArgs, stdinInput, outputFormat };

  return builtArgs;
};

export const buildReviewArgArray = (config: ProviderConfig, args: ReviewToolArgs): BuiltArgs => {
  const reviewCmd = getReviewCommand(config);
  const cliArgs: string[] = [];

  appendValueFlag(cliArgs, reviewCmd, FLAG_MODEL, args.model);
  appendValueFlag(cliArgs, reviewCmd, FLAG_WORKING_DIR, args.working_directory);

  if (reviewCmd.args?.length) {
    cliArgs.push(...reviewCmd.args);
  }

  appendReviewScopeArgs(cliArgs, reviewCmd, args);

  const builtArgs: BuiltArgs = { args: cliArgs, outputFormat: config.outputFormat };

  return builtArgs;
};
