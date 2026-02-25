import type { FlagValue, ProviderConfig } from '../../../../shared/common';
import { ASK_PROVIDER_CONFIG_STUB } from '../../../common/stubs';

type AskCommandConfig = Readonly<{
  method: ProviderConfig['input']['method'];
  args: string[];
  trailingArgs?: string[];
  flags: Record<string, FlagValue>;
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
