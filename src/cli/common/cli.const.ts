export const ASK_ALL_PROVIDER_FLAGS: string[] = ['--provider', '--providers'];

export const ASK_ALL_MODEL_FLAGS: string[] = ['--model', '--models'];

export const ASK_ALL_VALUE_FLAGS: string[] = [
  '--config',
  '--context',
  '--model',
  '--providers',
  '--system-prompt',
  '--working-dir',
];

export const ASK_ALL_BOOLEAN_FLAGS: string[] = ['--include-structured', '--stream-live'];

export const GLOBAL_SUBCOMMANDS: string[] = ['ask_all', 'list_providers', 'provider_metrics'];

export const PROVIDER_SUBCOMMAND_PREFIXES: string[] = ['ask_', 'review_', 'ping_', 'help_', 'sessions_'];
