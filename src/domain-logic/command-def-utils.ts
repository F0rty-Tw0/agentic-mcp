import { ValidationError } from '../common/errors/validation-error.ts';
import type { CommandDef, FlagValue, ProviderConfig } from '../common/provider-config.schema.ts';

export const FLAG_MODEL = 'model';

export const FLAG_WORKING_DIR = 'workingDir';

export const FLAG_FILE = 'file';

export const FLAG_AUTO_MODE = 'autoMode';

export const FLAG_SANDBOX = 'sandbox';

export const getAskCommand = (config: ProviderConfig): CommandDef => {
  const { ask } = config.commands;

  if (!ask) throw new ValidationError('Provider config missing required "ask" command');

  return ask;
};

export const getFlag = (cmd: CommandDef, key: string): FlagValue | undefined => {
  return cmd.flags?.[key];
};
