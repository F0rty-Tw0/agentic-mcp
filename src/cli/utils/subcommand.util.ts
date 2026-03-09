import type { CliSubcommand } from '../common';

const GLOBAL_SUBCOMMANDS = new Set<CliSubcommand>(['ask_all', 'list_providers', 'provider_metrics']);
const PROVIDER_SUBCOMMAND_PREFIXES = ['ask_', 'ping_', 'help_', 'sessions_'] as const;

type ProviderSubcommandPrefix = (typeof PROVIDER_SUBCOMMAND_PREFIXES)[number];

const hasProviderSuffix = (arg: string, prefix: ProviderSubcommandPrefix): boolean => {
  const result = arg.startsWith(prefix) && arg.length > prefix.length;

  return result;
};

export const parseSubcommand = (arg: string): CliSubcommand | undefined => {
  const cliCommand = arg as CliSubcommand;

  if (GLOBAL_SUBCOMMANDS.has(cliCommand)) {
    const result = cliCommand;

    return result;
  }

  for (const prefix of PROVIDER_SUBCOMMAND_PREFIXES) {
    if (hasProviderSuffix(cliCommand, prefix)) {
      const result = cliCommand;

      return result;
    }
  }

  return;
};

export const isCliSubcommand = (arg: string): boolean => {
  const subCommand = parseSubcommand(arg as CliSubcommand);
  const result = subCommand !== undefined;

  return result;
};
