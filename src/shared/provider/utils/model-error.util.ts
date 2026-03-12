import { buildProviderQueueOptions } from './provider-queue-options.util';
import type { ExecuteCommandOptions, ExecutionResult } from '../../command-execution';
import type { ResolvedProviderEntry } from '../common';

const MODEL_ERROR_PATTERN =
  /model[_ ]not[_ ]found|modelnotfounderror|model.*not found|model.*not supported|model.*does not exist|unknown model|invalid model|no such model/i;

const MODEL_NAME_PATTERN =
  /(?:model[_ ]not[_ ]found|modelnotfounderror|unknown model|invalid model|no such model|model.*does not exist)[:\s]+["']?([^\s."',]+(?:\/[^\s."',]+)?)["']?/i;

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

const isModelLine = (line: string): boolean => Boolean(line) && !line.startsWith('#') && !line.startsWith('-');

const tokenizeModel = (value: string): string[] => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (!normalized) return [];

  return normalized.split(/\s+/);
};

const extractModelVersion = (value: string): { major: number; minor: number } | undefined => {
  const match = /(\d+)\.(\d+)/.exec(value);

  if (!match?.[1] || !match[2]) return;

  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);

  if (Number.isNaN(major) || Number.isNaN(minor)) return;

  return { major, minor };
};

const scoreByVersion = (requestedModel: string, candidateModel: string): number => {
  const requestedVersion = extractModelVersion(requestedModel);
  const candidateVersion = extractModelVersion(candidateModel);

  if (!requestedVersion || !candidateVersion) return 0;

  if (requestedVersion.major === candidateVersion.major && requestedVersion.minor === candidateVersion.minor) return 32;

  if (requestedVersion.major !== candidateVersion.major) return 0;

  const minorDistance = Math.abs(requestedVersion.minor - candidateVersion.minor);

  return Math.max(0, 14 - minorDistance * 3);
};

const scoreModelCandidate = (requestedModel: string, candidateModel: string): number => {
  const requestedTokens = tokenizeModel(requestedModel);
  const candidateTokens = tokenizeModel(candidateModel);

  if (!requestedTokens.length || !candidateTokens.length) return 0;

  const requestedSet = new Set(requestedTokens);
  const sharedTokenCount = candidateTokens.filter((token) => requestedSet.has(token)).length;
  const hasCodexHint = requestedSet.has('codex');
  const hasCodexCandidate = candidateTokens.includes('codex');
  const hasGptCandidate = candidateTokens.includes('gpt');
  let score = sharedTokenCount * 6 + scoreByVersion(requestedModel, candidateModel);

  if (hasCodexHint && hasCodexCandidate) score += 12;

  if (hasCodexHint && !hasCodexCandidate && hasGptCandidate) score += 8;

  return score;
};

const parseAvailableModels = (availableModels: string): string[] => {
  return availableModels
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => isModelLine(line));
};

export const parseFirstAvailableModel = (availableModels: string): string | undefined => {
  const firstModel = parseAvailableModels(availableModels)[0];

  return firstModel;
};

export const selectClosestAvailableModel = (requestedModel: string, availableModels: string): string | undefined => {
  const models = parseAvailableModels(availableModels);

  if (!models.length) return;

  const exactMatch = models.find((model) => model.toLowerCase() === requestedModel.toLowerCase());

  if (exactMatch) return exactMatch;

  let bestModel: string | undefined;
  let bestScore = 0;
  let hasTie = false;

  for (const model of models) {
    const candidateScore = scoreModelCandidate(requestedModel, model);

    if (candidateScore > bestScore) {
      bestScore = candidateScore;
      bestModel = model;
      hasTie = false;
      continue;
    }

    if (candidateScore === bestScore && candidateScore > 0) {
      hasTie = true;
    }
  }

  if (bestScore < 12 || hasTie) return;

  return bestModel;
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
    const providerQueue = buildProviderQueueOptions(context);
    const options: ExecuteCommandOptions = {
      binaryPath: context.binaryPath,
      args,
      env,
      timeoutMs: MODELS_COMMAND_TIMEOUT_MS,
      providerQueue,
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
