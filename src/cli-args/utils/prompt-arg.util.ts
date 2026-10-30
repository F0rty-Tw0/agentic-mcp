import type { ProviderConfig } from '../../shared/provider/common';

// A leading '-' makes the provider CLI parse the prompt as an option (`--version`, `- fix X`).
export const guardPromptArg = (prompt: string): string => {
  const startsWithDash = prompt.startsWith('-');

  if (!startsWithDash) return prompt;

  const guardedPrompt = ` ${prompt}`;

  return guardedPrompt;
};

export const placesSessionArgsBeforePrompt = (config: ProviderConfig, sessionArgs: string[]): boolean => {
  const isPositional = config.input.method === 'positional';
  const isBeforePrompt = config.commands.sessions?.placement === 'beforePrompt';
  const hasSessionArgs = sessionArgs.length > 0;
  const placesBeforePrompt = isPositional && isBeforePrompt && hasSessionArgs;

  return placesBeforePrompt;
};
