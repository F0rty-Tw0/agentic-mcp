import type { ResolvedProviderEntry } from '../../shared';
import { MODEL_REGEX, executeCommand, fetchAvailableModels, selectClosestAvailableModel } from '../../shared';
import type { AskToolArgs } from '../common';

type ExecutionEnv = Readonly<Record<string, string>>;

type ResolveRequestedModelInput = Readonly<{
  context: ResolvedProviderEntry;
  args: AskToolArgs;
  env: ExecutionEnv;
}>;

const shouldResolveClosestModel = (model: string): boolean => {
  const needsNormalization = !MODEL_REGEX.test(model);

  return needsNormalization;
};

export const resolveRequestedModel = async (
  resolveRequestedModelInput: ResolveRequestedModelInput
): Promise<AskToolArgs> => {
  const { context, args, env } = resolveRequestedModelInput;
  const requestedModel = args.model;

  if (!requestedModel || !shouldResolveClosestModel(requestedModel)) return args;

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
