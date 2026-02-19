import type { CommandDef, FlagValue, ProviderConfig } from '../common/provider-config.types.ts';

const FLAG_MODEL = 'model';
const FLAG_WORKING_DIR = 'workingDir';
const FLAG_FILE = 'file';
const FLAG_AUTO_MODE = 'autoMode';
const FLAG_SANDBOX = 'sandbox';

const getAskCommand = (config: ProviderConfig): CommandDef => {
  const cmd = config.commands.ask;

  if (!cmd) {
    throw new Error('Provider config missing required "ask" command');
  }

  return cmd;
};

const getFlag = (cmd: CommandDef, key: string): FlagValue | undefined => {
  return cmd.flags?.[key];
};

/**
 * Resolves a FlagValue into CLI arguments.
 *
 * - string flag (e.g. "--model"): [flag, value] or [flag] if no value
 * - string[] flags (e.g. ["--dangerously-skip-permissions"]): all elements
 * - LeveledFlag (e.g. { flag: "--sandbox", values: [...] }): [flag, value]
 * - null: []
 */
const resolveFlagToArgs = (flagValue: FlagValue, argValue?: string): string[] => {
  if (flagValue === null) return [];

  if (typeof flagValue === 'string') {
    return argValue !== undefined ? [flagValue, argValue] : [flagValue];
  }

  if (Array.isArray(flagValue)) return [...flagValue];

  const leveledFlag = argValue !== undefined ? [flagValue.flag, argValue] : [flagValue.flag];

  return leveledFlag;
};

const appendModelFlag = (
  cliArgs: string[],
  askCmd: CommandDef,
  model: string | undefined,
): void => {
  const flag = getFlag(askCmd, FLAG_MODEL);

  if (model && flag != null) {
    cliArgs.push(...resolveFlagToArgs(flag, model));
  }
};

const appendWorkingDirFlag = (
  cliArgs: string[],
  askCmd: CommandDef,
  workingDir: string | undefined,
): void => {
  const flag = getFlag(askCmd, FLAG_WORKING_DIR);

  if (workingDir && flag != null) {
    cliArgs.push(...resolveFlagToArgs(flag, workingDir));
  }
};

const appendFileFlags = (
  cliArgs: string[],
  askCmd: CommandDef,
  files: string[] | undefined,
): void => {
  const flag = getFlag(askCmd, FLAG_FILE);

  if (files && files.length > 0 && flag != null && typeof flag === 'string') {
    for (const file of files) {
      cliArgs.push(flag, file);
    }
  }
};

const appendAutoModeFlag = (
  cliArgs: string[],
  askCmd: CommandDef,
  autoMode: boolean | undefined,
): void => {
  const flag = getFlag(askCmd, FLAG_AUTO_MODE);

  if (autoMode === true && flag != null) {
    cliArgs.push(...resolveFlagToArgs(flag));
  }
};

const appendSandboxFlag = (
  cliArgs: string[],
  askCmd: CommandDef,
  sandbox: string | boolean | undefined,
): void => {
  const flag = getFlag(askCmd, FLAG_SANDBOX);

  if (sandbox !== undefined && flag != null) {
    const sandboxValue = typeof sandbox === 'string' ? sandbox : undefined;

    cliArgs.push(...resolveFlagToArgs(flag, sandboxValue));
  }
};

const appendOptionalFlags = (
  cliArgs: string[],
  askCmd: CommandDef,
  args: Record<string, unknown>,
): void => {
  appendModelFlag(cliArgs, askCmd, args.model as string | undefined);
  appendWorkingDirFlag(cliArgs, askCmd, args.working_directory as string | undefined);
  appendFileFlags(cliArgs, askCmd, args.files as string[] | undefined);
  appendAutoModeFlag(cliArgs, askCmd, args.auto_mode as boolean | undefined);
  appendSandboxFlag(cliArgs, askCmd, args.sandbox as string | boolean | undefined);
};

export const buildArgArray = (
  config: ProviderConfig,
  args: Record<string, unknown>,
): { args: string[]; stdinInput?: string } => {
  const cliArgs: string[] = [];
  let stdinInput: string | undefined;

  const prompt = args.prompt as string;
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
