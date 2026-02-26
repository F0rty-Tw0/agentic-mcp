import type { FlagValue, ProviderConfig } from '../../../../shared/common';
import { ASK_PROVIDER_CONFIG_STUB } from '../../../common/stubs';

type AskFlagMap = Readonly<Record<string, FlagValue>>;

type AskCommandConfig = Readonly<{
  method: ProviderConfig['input']['method'];
  args: string[];
  trailingArgs?: string[];
  flags: AskFlagMap;
}>;

const DEFAULT_CONFIG_OPTIONS: AskCommandConfig = {
  method: 'positional',
  args: ['run'],
  flags: {},
};

export const createCliArgsConfig = (overrides: Partial<AskCommandConfig> = {}): ProviderConfig => {
  const { method, args, trailingArgs, flags } = { ...DEFAULT_CONFIG_OPTIONS, ...overrides };

  return {
    ...ASK_PROVIDER_CONFIG_STUB,
    commands: {
      ask: { args, trailingArgs, flags },
    },
    input: { method },
  };
};
