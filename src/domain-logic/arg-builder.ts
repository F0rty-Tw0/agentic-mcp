import type { CommandDef, FlagValue, ProviderConfig } from '../common/provider-config.types.ts';

const FLAG_MODEL = 'model';
const FLAG_WORKING_DIR = 'workingDir';
const FLAG_FILE = 'file';
const FLAG_AUTO_MODE = 'autoMode';
const FLAG_SANDBOX = 'sandbox';

function getAskCommand(config: ProviderConfig): CommandDef {
  const cmd = config.commands.ask;

  if (!cmd) {
    throw new Error('Provider config missing required "ask" command');
  }

  return cmd;
}

function getFlag(cmd: CommandDef, key: string): FlagValue | undefined {
  return cmd.flags?.[key];
}

/**
 * Resolves a FlagValue into CLI arguments.
 *
 * - string flag (e.g. "--model"): [flag, value] or [flag] if no value
 * - string[] flags (e.g. ["--dangerously-skip-permissions"]): all elements
 * - LeveledFlag (e.g. { flag: "--sandbox", values: [...] }): [flag, value]
 * - null: []
 */
function resolveFlagToArgs(flagValue: FlagValue, argValue?: string): string[] {
  if (flagValue === null) return [];

  if (typeof flagValue === 'string') {
    return argValue !== undefined ? [flagValue, argValue] : [flagValue];
  }

  if (Array.isArray(flagValue)) {
    return [...flagValue];
  }

  // LeveledFlag
  return argValue !== undefined ? [flagValue.flag, argValue] : [flagValue.flag];
}

// eslint-disable-next-line complexity -- flat sequence of independent flag checks
function appendOptionalFlags(
  cliArgs: string[],
  askCmd: CommandDef,
  args: Record<string, unknown>,
): void {
  const model = args.model as string | undefined;
  const workingDir = args.working_directory as string | undefined;
  const files = args.files as string[] | undefined;
  const autoMode = args.auto_mode as boolean | undefined;
  const sandbox = args.sandbox as string | boolean | undefined;

  const modelFlag = getFlag(askCmd, FLAG_MODEL);

  if (model && modelFlag != null) {
    cliArgs.push(...resolveFlagToArgs(modelFlag, model));
  }

  const workingDirFlag = getFlag(askCmd, FLAG_WORKING_DIR);

  if (workingDir && workingDirFlag != null) {
    cliArgs.push(...resolveFlagToArgs(workingDirFlag, workingDir));
  }

  const fileFlag = getFlag(askCmd, FLAG_FILE);

  if (files && files.length > 0 && fileFlag != null && typeof fileFlag === 'string') {
    for (const file of files) {
      cliArgs.push(fileFlag, file);
    }
  }

  const autoModeFlag = getFlag(askCmd, FLAG_AUTO_MODE);

  if (autoMode === true && autoModeFlag != null) {
    cliArgs.push(...resolveFlagToArgs(autoModeFlag));
  }

  const sandboxFlag = getFlag(askCmd, FLAG_SANDBOX);

  if (sandbox !== undefined && sandboxFlag != null) {
    const sandboxValue = typeof sandbox === 'string' ? sandbox : undefined;

    cliArgs.push(...resolveFlagToArgs(sandboxFlag, sandboxValue));
  }
}

export function buildArgArray(
  config: ProviderConfig,
  args: Record<string, unknown>,
): { args: string[]; stdinInput?: string } {
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
}
