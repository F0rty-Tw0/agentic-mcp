import { ASK_PROVIDER_CONFIG_STUB } from '../../../ask/common/stubs';
import type { FlagValue, ProviderConfig } from '../../../shared';

type AskFlagMap = Readonly<Record<string, FlagValue>>;

type AskCommandConfig = Readonly<{
  method: ProviderConfig['input']['method'];
  args: string[];
  trailingArgs?: string[];
  flags: AskFlagMap;
  streaming?: ProviderConfig['commands']['ask']['streaming'];
}>;

const DEFAULT_CONFIG_OPTIONS: AskCommandConfig = {
  method: 'positional',
  args: ['run'],
  flags: {},
};

export const createCliArgsConfig = (overrides: Partial<AskCommandConfig> = {}): ProviderConfig => {
  const { method, args, trailingArgs, flags, streaming } = { ...DEFAULT_CONFIG_OPTIONS, ...overrides };
  const askCommand = streaming ? { args, trailingArgs, flags, streaming } : { args, trailingArgs, flags };

  return {
    ...ASK_PROVIDER_CONFIG_STUB,
    commands: {
      ask: askCommand,
    },
    input: { method },
  };
};
