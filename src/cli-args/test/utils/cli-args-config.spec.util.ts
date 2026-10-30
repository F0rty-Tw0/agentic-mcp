import { ASK_PROVIDER_CONFIG_STUB } from '../../../ask/common/stubs';
import type { CommandDef, FlagValue, ProviderConfig } from '../../../shared/provider/common';

type AskFlagMap = Readonly<Record<string, FlagValue>>;

type AskCommandConfig = {
  readonly method: ProviderConfig['input']['method'];
  readonly args: string[];
  readonly trailingArgs?: string[];
  readonly flags: AskFlagMap;
  readonly streaming?: CommandDef['streaming'];
};

const DEFAULT_CONFIG_OPTIONS: AskCommandConfig = {
  method: 'positional',
  args: ['run'],
  flags: {},
};

export const createCliArgsConfig = (overrides: Partial<AskCommandConfig> = {}): ProviderConfig => {
  const { method, args, trailingArgs, flags, streaming } = { ...DEFAULT_CONFIG_OPTIONS, ...overrides };
  const plainAskCommand: CommandDef = { args, trailingArgs, flags };
  const streamingAskCommand: CommandDef = { args, trailingArgs, flags, streaming };
  const askCommand = streaming ? streamingAskCommand : plainAskCommand;
  const commands: ProviderConfig['commands'] = { ask: askCommand };
  const input: ProviderConfig['input'] = { method };
  const cliArgsConfig: ProviderConfig = {
    ...ASK_PROVIDER_CONFIG_STUB,
    commands,
    input,
  };

  return cliArgsConfig;
};
