export type CliCommandType = 'ask' | 'ask_all' | 'ping' | 'help' | 'list_providers' | 'provider_metrics';

export type ParsedCliCommand = Readonly<{
  type: CliCommandType;
  providerName?: string;
}>;
