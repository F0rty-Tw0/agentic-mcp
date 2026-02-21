import { ValidationError } from '../../../shared/common/errors/validation-error.ts';
import type { CommandDef, FlagValue, ProviderConfig } from '../../../shared/common/provider-config.schema.ts';
import {
  FLAG_AUTO_MODE,
  FLAG_EFFORT,
  FLAG_FILE,
  FLAG_MAX_BUDGET,
  FLAG_MODEL,
  FLAG_SANDBOX,
  FLAG_SYSTEM_PROMPT,
  FLAG_WORKING_DIR,
} from '../common/command-def.const.ts';
import type { AskToolArgs, BuiltArgs } from '../common/tool-args.types.ts';
import { getAskCommand, getFlag } from '../utils/command-def-utils.ts';

/**
 * Resolves a FlagValue into CLI arguments.
 *
 * - string flag (e.g. "--model"): [flag, value] or [flag] if no value
 * - string[] flags (e.g. ["--dangerously-skip-permissions"]): all elements
 * - LeveledFlag (e.g. { flag: "--sandbox", values: [...] }): [flag, value]
 * - null: []
 */
const resolveFlagToArgs = (flagValue?: FlagValue, argValue?: string): string[] => {
  if (!flagValue) return [];

  if (typeof flagValue === 'string') {
    return argValue ? [flagValue, argValue] : [flagValue];
  }

  if (Array.isArray(flagValue)) return [...flagValue];

  // LeveledFlag — requires a value; emit nothing if no value provided
  if (!argValue) return [];

  if (!flagValue.values.includes(argValue)) {
    throw new ValidationError(
      `Invalid value "${argValue}" for flag "${flagValue.flag}". Allowed: ${flagValue.values.join(', ')}`,
    );
  }

  return [flagValue.flag, argValue];
};

const appendValueFlag = (
  cliArgs: string[],
  askCmd: CommandDef,
  flagKey: string,
  value: string | boolean | undefined,
): void => {
  // Falsy check is intentional: undefined = not provided, false = don't enable, "" = empty value
  if (!value) return;

  const flag = getFlag(askCmd, flagKey);

  if (flag == null) return;

  const argValue = typeof value === 'string' ? value : undefined;
  const flagArgs = resolveFlagToArgs(flag, argValue);

  cliArgs.push(...flagArgs);
};

const appendFileFlags = (cliArgs: string[], askCmd: CommandDef, files: readonly string[] | undefined): void => {
  if (!files?.length) return;

  const flag = getFlag(askCmd, FLAG_FILE);

  if (flag == null) return;

  if (typeof flag !== 'string') {
    throw new ValidationError(
      `File flag must be a simple string flag, got ${Array.isArray(flag) ? 'array' : 'object'}`,
    );
  }

  for (const file of files) {
    cliArgs.push(flag, file);
  }
};

const appendSandboxFlag = (cliArgs: string[], askCmd: CommandDef, sandbox: string | boolean | undefined): void => {
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

export const buildArgArray = (config: ProviderConfig, args: AskToolArgs): BuiltArgs => {
  const cliArgs: string[] = [];
  let stdinInput: string | undefined;

  if (!args.prompt) throw new ValidationError('Missing required "prompt" argument');

  const askCmd = getAskCommand(config);

  // Pre-prompt args (subcommand for positional input, flag prefix for flag input)
  if (askCmd.args?.length) {
    cliArgs.push(...askCmd.args);
  }

  // Prompt delivery based on input method
  if (config.input.method === 'stdin') {
    stdinInput = args.prompt;
  } else {
    cliArgs.push(args.prompt);
  }

  // Append all optional flag-based args
  appendOptionalFlags(cliArgs, askCmd, args);

  // Trailing args (output format flags, etc.)
  if (askCmd.trailingArgs?.length) {
    cliArgs.push(...askCmd.trailingArgs);
  }

  const builtArgs: BuiltArgs = { args: cliArgs, stdinInput };

  return builtArgs;
};
