import { SUPPORTED_CLIENTS } from '../common';
import type { ParsedSetupArgs, SetupBackupPolicy, SetupMode, SetupOutputMode, SupportedClient } from '../common';

const DEFAULT_CLIENT: SupportedClient = 'generic';
const DEFAULT_OUTPUT: SetupOutputMode = 'human';
const DEFAULT_MODE: SetupMode = 'merge';
const DEFAULT_BACKUP: SetupBackupPolicy = 'if-exists';

type ParseSetupArgsInput = Readonly<{
  args: readonly string[];
  stderrWrite: (text: string) => void;
}>;

type ValueFlag = '--client' | '--output' | '--mode' | '--path' | '--backup';

type MutableParsedSetupArgs = {
  client: SupportedClient;
  dryRun: boolean;
  yes: boolean;
  output: SetupOutputMode;
  mode: SetupMode;
  pathOverride?: string;
  backup: SetupBackupPolicy;
  minimal: boolean;
};

const isSupportedClient = (value: string): value is SupportedClient => {
  return SUPPORTED_CLIENTS.includes(value as SupportedClient);
};

const parseMode = (value: string): SetupMode | undefined => {
  if (value === 'merge' || value === 'overwrite') {
    return value;
  }

  return undefined;
};

const parseBackupPolicy = (value: string): SetupBackupPolicy | undefined => {
  if (value === 'if-exists' || value === 'always' || value === 'never') {
    return value;
  }

  return undefined;
};

const parseOutputMode = (value: string): SetupOutputMode | undefined => {
  if (value === 'human' || value === 'json') {
    return value;
  }

  return undefined;
};

const parseValueFlag = (
  flag: ValueFlag,
  value: string,
  parsed: MutableParsedSetupArgs,
  stderrWrite: (text: string) => void
): void => {
  switch (flag) {
    case '--client': {
      if (isSupportedClient(value)) {
        parsed.client = value;
      } else {
        stderrWrite(`Warning: unknown client "${value}", using "generic"\n`);
      }

      return;
    }
    case '--output': {
      const outputMode = parseOutputMode(value);

      if (outputMode != null) {
        parsed.output = outputMode;
      } else {
        stderrWrite(`Warning: unknown output mode "${value}", using "human"\n`);
      }

      return;
    }
    case '--mode': {
      const mode = parseMode(value);

      if (mode != null) {
        parsed.mode = mode;
      } else {
        stderrWrite(`Warning: unknown mode "${value}", using "merge"\n`);
      }

      return;
    }
    case '--path': {
      parsed.pathOverride = value;

      return;
    }
    case '--backup': {
      const backupPolicy = parseBackupPolicy(value);

      if (backupPolicy != null) {
        parsed.backup = backupPolicy;
      } else {
        stderrWrite(`Warning: unknown backup policy "${value}", using "if-exists"\n`);
      }

      return;
    }
    default:
      return;
  }
};

const consumeBooleanFlag = (arg: string, parsed: MutableParsedSetupArgs): boolean => {
  if (arg === '--dry-run') {
    parsed.dryRun = true;

    return true;
  }

  if (arg === '--yes') {
    parsed.yes = true;

    return true;
  }

  if (arg === '--minimal') {
    parsed.minimal = true;

    return true;
  }

  return false;
};

const isValueFlag = (arg: string): arg is ValueFlag => {
  return arg === '--client' || arg === '--output' || arg === '--mode' || arg === '--path' || arg === '--backup';
};

export const parseSetupArgs = ({ args, stderrWrite }: ParseSetupArgsInput): ParsedSetupArgs => {
  const parsed: MutableParsedSetupArgs = {
    client: DEFAULT_CLIENT,
    dryRun: false,
    yes: false,
    output: DEFAULT_OUTPUT,
    mode: DEFAULT_MODE,
    pathOverride: undefined,
    backup: DEFAULT_BACKUP,
    minimal: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg == null || consumeBooleanFlag(arg, parsed) || !isValueFlag(arg)) {
      continue;
    }

    const value = args[i + 1];

    if (value == null) {
      continue;
    }

    parseValueFlag(arg, value, parsed, stderrWrite);
    i++;
  }

  const result: ParsedSetupArgs = {
    ...parsed,
  };

  return result;
};
