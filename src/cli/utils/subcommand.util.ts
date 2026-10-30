import type { CliSubcommand } from '../common';
import { GLOBAL_SUBCOMMANDS, PROVIDER_SUBCOMMAND_PREFIXES } from '../common/cli.const';

const isGlobalSubcommand = (arg: string): arg is CliSubcommand => {
  const result = GLOBAL_SUBCOMMANDS.includes(arg);

  return result;
};

const hasProviderSuffix = (arg: string, prefix: string): arg is CliSubcommand => {
  const result = arg.startsWith(prefix) && arg.length > prefix.length;

  return result;
};

export const parseSubcommand = (arg: string): CliSubcommand | undefined => {
  if (isGlobalSubcommand(arg)) {
    const result = arg;

    return result;
  }

  for (const prefix of PROVIDER_SUBCOMMAND_PREFIXES) {
    if (hasProviderSuffix(arg, prefix)) {
      const result = arg;

      return result;
    }
  }

  return;
};

export const isCliSubcommand = (arg: string): boolean => {
  const subCommand = parseSubcommand(arg);
  const result = subCommand !== undefined;

  return result;
};
