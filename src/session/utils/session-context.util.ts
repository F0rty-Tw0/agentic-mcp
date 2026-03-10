type BuildSessionPromptInput = Readonly<{
  sessionTurnsText: string;
  userContext?: string;
  prompt: string;
}>;

export const buildSessionPrompt = ({ sessionTurnsText, userContext, prompt }: BuildSessionPromptInput): string => {
  const parts: string[] = [];

  if (sessionTurnsText.length > 0) {
    parts.push(`Previous context:\n${sessionTurnsText}`);
  }

  if (userContext && userContext.length > 0) {
    parts.push(`Additional context:\n${userContext}`);
  }

  parts.push(`Current request:\n${prompt}`);

  const result = parts.join('\n\n');

  return result;
};
