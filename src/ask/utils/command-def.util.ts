import type { CommandDef, FlagValue, ProviderConfig } from '../../shared';
import { ValidationError } from '../../shared';
import type { ResolvedAskCommand } from '../common';

export const getAskCommand = (config: ProviderConfig): CommandDef => {
  const { ask } = config.commands;

  if (!ask) throw new ValidationError('Provider config missing required "ask" command');

  return ask;
};

export const getReviewCommand = (config: ProviderConfig): CommandDef => {
  const { review } = config.commands;

  if (!review) throw new ValidationError('Provider config missing required "review" command');

  return review;
};

export const resolveAskCommand = (config: ProviderConfig, streamLive = false): ResolvedAskCommand => {
  const ask = getAskCommand(config);
  const streaming = streamLive ? ask.streaming : undefined;
  const command: CommandDef = streaming ? { ...ask, trailingArgs: streaming.trailingArgs ?? ask.trailingArgs } : ask;
  const outputFormat = streaming?.outputFormat ?? config.outputFormat;
  const result: ResolvedAskCommand = { command, outputFormat };

  return result;
};

export const getFlag = (cmd: CommandDef, key: string): FlagValue => {
  return cmd.flags?.[key];
};
