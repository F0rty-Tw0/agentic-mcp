const MODEL_ERROR_PATTERN = /model[_ ]not[_ ]found|model.*does not exist|unknown model|invalid model|no such model/i;

export const detectModelError = (stdout: string, stderr: string): boolean => {
  const modelErrorDetected = MODEL_ERROR_PATTERN.test(stdout) || MODEL_ERROR_PATTERN.test(stderr);

  return modelErrorDetected;
};

export const buildModelHint = (providerName: string): string => {
  const modelHint =
    `\n\nHint: The requested model (or the provider default) was not found. ` +
    `Specify a valid model via the "model" parameter. ` +
    `To list available models, run: ${providerName} models`;

  return modelHint;
};
