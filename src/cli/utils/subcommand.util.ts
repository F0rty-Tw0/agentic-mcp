import type { CliSubcommand } from '../common';

const GLOBAL_SUBCOMMANDS = new Set<CliSubcommand>(['ask_all', 'list_providers', 'provider_metrics']);
const PROVIDER_SUBCOMMAND_PREFIXES = ['ask_', 'ping_', 'help_', 'sessions_'] as const;

type ProviderSubcommandPrefix = (typeof PROVIDER_SUBCOMMAND_PREFIXES)[number];

const hasProviderSuffix = (arg: string, prefix: ProviderSubcommandPrefix): boolean => {
  const result = arg.startsWith(prefix) && arg.length > prefix.length;

  return result;
};

export const parseSubcommand = (arg: CliSubcommand): CliSubcommand | undefined => {
  if (GLOBAL_SUBCOMMANDS.has(arg)) {
    const result = arg;

    return result;
  }

  for (const prefix of PROVIDER_SUBCOMMAND_PREFIXES) {
    if (hasProviderSuffix(arg, prefix)) {
      const result = arg;

      return result;
    }
  }

  return undefined;
};

export const isCliSubcommand = (arg: CliSubcommand): boolean => {
  const subCommand = parseSubcommand(arg);
  const result = subCommand !== undefined;

  return result;
};
