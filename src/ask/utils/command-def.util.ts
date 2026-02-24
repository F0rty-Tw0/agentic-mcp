import type { CommandDef, FlagValue, ProviderConfig } from "../../shared/common";
import { ValidationError } from "../../shared/common/errors";

export const getAskCommand = (config: ProviderConfig): CommandDef => {
  const { ask } = config.commands;

  if (!ask) throw new ValidationError('Provider config missing required "ask" command');

  return ask;
};

export const getFlag = (cmd: CommandDef, key: string): FlagValue | undefined => {
  return cmd.flags?.[key];
};
