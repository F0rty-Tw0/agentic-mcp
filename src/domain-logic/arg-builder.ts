import { FLAG_AUTO_MODE, FLAG_FILE, FLAG_MODEL, FLAG_SANDBOX, FLAG_WORKING_DIR, getAskCommand, getFlag } from './command-def-utils.ts';
import type { CommandDef, FlagValue, ProviderConfig } from '../common/provider-config.schema.ts';
import type { AskToolArgs } from '../common/tool-args.types.ts';

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

  const leveledFlag = argValue ? [flagValue.flag, argValue] : [flagValue.flag];

  return leveledFlag;
};

const appendModelFlag = (cliArgs: string[], askCmd: CommandDef, model: string | undefined): void => {
  const flag = getFlag(askCmd, FLAG_MODEL);

  if (model && flag != null) {
    cliArgs.push(...resolveFlagToArgs(flag, model));
  }
};

const appendWorkingDirFlag = (cliArgs: string[], askCmd: CommandDef, workingDir: string | undefined): void => {
  const flag = getFlag(askCmd, FLAG_WORKING_DIR);

  if (workingDir && flag != null) {
    cliArgs.push(...resolveFlagToArgs(flag, workingDir));
  }
};

const appendFileFlags = (cliArgs: string[], askCmd: CommandDef, files: readonly string[] | undefined): void => {
  const flag = getFlag(askCmd, FLAG_FILE);

  if (files && files.length > 0 && flag != null && typeof flag === 'string') {
    for (const file of files) {
      cliArgs.push(flag, file);
    }
  }
};

const appendAutoModeFlag = (cliArgs: string[], askCmd: CommandDef, autoMode: boolean | undefined): void => {
  const flag = getFlag(askCmd, FLAG_AUTO_MODE);

  if (autoMode === true && flag != null) {
    cliArgs.push(...resolveFlagToArgs(flag));
  }
};

const appendSandboxFlag = (cliArgs: string[], askCmd: CommandDef, sandbox: string | boolean | undefined): void => {
  const flag = getFlag(askCmd, FLAG_SANDBOX);

  if (sandbox === undefined || flag == null) return;

  const sandboxValue = typeof sandbox === 'string' ? sandbox : undefined;

  cliArgs.push(...resolveFlagToArgs(flag, sandboxValue));
};

const appendOptionalFlags = (cliArgs: string[], askCmd: CommandDef, args: AskToolArgs): void => {
  appendModelFlag(cliArgs, askCmd, args.model);
  appendWorkingDirFlag(cliArgs, askCmd, args.working_directory);
  appendFileFlags(cliArgs, askCmd, args.files);
  appendAutoModeFlag(cliArgs, askCmd, args.auto_mode);
  appendSandboxFlag(cliArgs, askCmd, args.sandbox);
};

export const buildArgArray = (config: ProviderConfig, args: AskToolArgs): { args: string[]; stdinInput?: string } => {
  const cliArgs: string[] = [];
  let stdinInput: string | undefined;

  if (!args.prompt) throw new Error('Missing required "prompt" argument');

  const prompt = args.prompt;
  const askCmd = getAskCommand(config);

  // Pre-prompt positional args (subcommand or flag before the prompt value)
  if (askCmd.args) {
    cliArgs.push(...askCmd.args);
  }

  // Prompt delivery based on input method
  if (config.input.method === 'stdin') {
    stdinInput = prompt;
  } else {
    cliArgs.push(prompt);
  }

  // Append all optional flag-based args
  appendOptionalFlags(cliArgs, askCmd, args);

  // Trailing args (output format flags, etc.)
  if (askCmd.trailingArgs) {
    cliArgs.push(...askCmd.trailingArgs);
  }

  return { args: cliArgs, stdinInput };
};
