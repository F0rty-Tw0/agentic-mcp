import { executeCommand, fetchAvailableModels, selectClosestAvailableModel } from '../../shared';
import type { ResolvedProviderEntry } from '../../shared/provider/common';
import type { AskToolArgs } from '../common';

type ExecutionEnv = Readonly<Record<string, string>>;

type ResolveRequestedModelInput = {
  readonly context: ResolvedProviderEntry;
  readonly args: AskToolArgs;
  readonly env: ExecutionEnv;
};

export const resolveRequestedModel = async (
  resolveRequestedModelInput: ResolveRequestedModelInput
): Promise<AskToolArgs> => {
  const { context, args, env } = resolveRequestedModelInput;
  const requestedModel = args.model;

  if (!requestedModel) return args;

  const availableModels = await fetchAvailableModels(context, env, executeCommand);

  if (!availableModels) return args;

  const closestModel = selectClosestAvailableModel(requestedModel, availableModels);

  if (!closestModel) return args;

  const resolvedArgs: AskToolArgs = {
    ...args,
    model: closestModel,
  };

  return resolvedArgs;
};
