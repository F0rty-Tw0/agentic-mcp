import path from 'node:path';

import { MAX_FILES, MAX_PROMPT_BYTES, ValidationError } from '../common';

export const MODEL_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._:\-/]{0,127}$/;

export const SESSION_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/;

export const validateModel = (model: string): void => {
  const isValidModel = MODEL_REGEX.test(model);

  if (!isValidModel)
    throw new ValidationError(`Invalid model identifier: "${model}". Must match ${String(MODEL_REGEX)}`);
};

export const validateSessionId = (sessionId: string): void => {
  const isValidSessionId = SESSION_ID_REGEX.test(sessionId);

  if (!isValidSessionId)
    throw new ValidationError(`Invalid session ID: "${sessionId}". Must match ${String(SESSION_ID_REGEX)}`);
};

export const validatePromptSize = (prompt?: string): void => {
  if (!prompt) throw new ValidationError('Prompt is required');

  const bytes = Buffer.byteLength(prompt, 'utf-8');

  if (bytes > MAX_PROMPT_BYTES)
    throw new ValidationError(`Prompt exceeds maximum size: ${bytes} bytes (limit: ${MAX_PROMPT_BYTES})`);
};

export const validateWorkingDirectory = (dir: string): string => {
  return path.resolve(dir);
};

export const validateFiles = (files: string[], workingDir: string): string[] => {
  if (files.length > MAX_FILES) throw new ValidationError(`Too many files: ${files.length} (limit: ${MAX_FILES})`);

  const hasTrailingSeparator = workingDir.endsWith(path.sep);
  const separatedWorkingDir = workingDir + path.sep;
  const safeRoot = hasTrailingSeparator ? workingDir : separatedWorkingDir;

  return files.map((file) => {
    const resolved = path.resolve(workingDir, file);
    const isInsideSafeRoot = resolved.startsWith(safeRoot);

    if (!isInsideSafeRoot && resolved !== workingDir)
      throw new ValidationError(`File path escapes working directory: "${file}"`);

    return resolved;
  });
};
