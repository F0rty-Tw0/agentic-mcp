import type { ParsedCliCommand } from '../common';

export const parseSubcommand = (arg: string): ParsedCliCommand | undefined => {
  if (arg === 'ask_all') {
    const result: ParsedCliCommand = { type: 'ask_all' };

    return result;
  }

  if (arg === 'list_providers') {
    const result: ParsedCliCommand = { type: 'list_providers' };

    return result;
  }

  if (arg === 'provider_metrics') {
    const result: ParsedCliCommand = { type: 'provider_metrics' };

    return result;
  }

  if (arg.startsWith('ask_')) {
    const providerName = arg.slice('ask_'.length);

    if (!providerName) return;

    const result: ParsedCliCommand = { type: 'ask', providerName };

    return result;
  }

  if (arg.startsWith('ping_')) {
    const providerName = arg.slice('ping_'.length);

    if (!providerName) return undefined;

    const result: ParsedCliCommand = { type: 'ping', providerName };

    return result;
  }

  if (arg.startsWith('help_')) {
    const providerName = arg.slice('help_'.length);

    if (!providerName) return;

    const result: ParsedCliCommand = { type: 'help', providerName };

    return result;
  }

  return undefined;
};

export const isCliSubcommand = (arg: string): boolean => {
  const subCommand = parseSubcommand(arg);
  const result = subCommand !== undefined;

  return result;
};
