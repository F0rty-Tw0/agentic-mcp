export type CliSubcommand =
  | 'ask_all'
  | 'list_providers'
  | 'provider_metrics'
  | `ask_${string}`
  | `ping_${string}`
  | `help_${string}`
  | `sessions_${string}`;
