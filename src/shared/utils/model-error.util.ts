import type { ExecuteCommandOptions, ExecutionResult, ResolvedProviderEntry } from '../common';

const MODEL_ERROR_PATTERN = /model[_ ]not[_ ]found|model.*does not exist|unknown model|invalid model|no such model/i;

const MODEL_NAME_PATTERN =
  /(?:model[_ ]not[_ ]found|unknown model|invalid model|no such model|model.*does not exist)[:\s]+["']?([^\s."',]+(?:\/[^\s."',]+)?)["']?/i;

const QUOTED_MODEL_PATTERN = /(?:model|invalid model|unknown model)\s+["']([^"']+)["']/i;

const MODELS_COMMAND_TIMEOUT_MS = 10_000;

type ExecuteCommandFn = (options: ExecuteCommandOptions) => Promise<ExecutionResult>;
type MinimalEnv = Readonly<Record<string, string>>;

export const detectModelError = (stdout: string, stderr: string): boolean => {
  const modelErrorDetected = MODEL_ERROR_PATTERN.test(stdout) || MODEL_ERROR_PATTERN.test(stderr);

  return modelErrorDetected;
};

export const extractAttemptedModel = (stdout: string, stderr: string): string | undefined => {
  const combined = `${stdout}\n${stderr}`;

  const quotedMatch = QUOTED_MODEL_PATTERN.exec(combined);

  if (quotedMatch?.[1]) return quotedMatch[1];

  const match = MODEL_NAME_PATTERN.exec(combined);

  return match?.[1];
};

export const buildModelHint = (
  providerName: string,
  attemptedModel?: string,
  availableModels?: string,
  userSpecified = true
): string => {
  let header: string;

  if (attemptedModel && userSpecified) {
    header = `Model error: The model "${attemptedModel}" was not found for provider "${providerName}".`;
  } else if (attemptedModel) {
    header = `Model error: No model was specified via the "model" parameter. The provider CLI attempted its default "${attemptedModel}", which was not found for provider "${providerName}".`;
  } else {
    header = `Model error: No model was specified and provider "${providerName}" has no default configured.`;
  }

  const modelsList = availableModels
    ? `\n\nAvailable models:\n${availableModels}`
    : `\n\nModel listing is not available for this provider. Try specifying a known model via the "model" parameter.`;

  const modelHint = `\n\n${header}${modelsList}`;

  return modelHint;
};

export const fetchAvailableModels = async (
  context: ResolvedProviderEntry,
  env: MinimalEnv,
  executeCommandFn: ExecuteCommandFn
): Promise<string | undefined> => {
  const { models } = context.config.commands;

  if (!models) return;

  try {
    const modelArgs = models.args ?? [];
    const trailingArgs = models.trailingArgs ?? [];
    const args = [...modelArgs, ...trailingArgs];
    const options: ExecuteCommandOptions = {
      binaryPath: context.binaryPath,
      args,
      env,
      timeoutMs: MODELS_COMMAND_TIMEOUT_MS,
      bypassSemaphore: true,
    };

    const result = await executeCommandFn(options);

    if (result.exitCode !== 0 || result.signal !== null || result.timedOut) return;

    const trimmed = result.stdout.trim();

    return trimmed ? trimmed : undefined;
  } catch (error: unknown) {
    void error;

    return;
  }
};
