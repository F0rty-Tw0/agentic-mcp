import type { CommandDef, FlagValue, ProviderConfig } from '../../shared';
import { ValidationError } from '../../shared';

export const getAskCommand = (config: ProviderConfig): CommandDef => {
  const { ask } = config.commands;

  if (!ask) throw new ValidationError('Provider config missing required "ask" command');

  return ask;
};

export const getFlag = (cmd: CommandDef, key: string): FlagValue => {
  return cmd.flags?.[key];
};
