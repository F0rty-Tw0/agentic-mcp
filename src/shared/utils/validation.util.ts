import path from 'node:path';

import { MAX_FILES, MAX_PROMPT_BYTES } from "../common";
import { ValidationError } from "../common/errors";

export const MODEL_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._:\-/]{0,127}$/;

export const SESSION_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/;

export const validateModel = (model: string): void => {
  if (!MODEL_REGEX.test(model)) {
    throw new ValidationError(`Invalid model identifier: "${model}". Must match ${String(MODEL_REGEX)}`);
  }
};

export const validateSessionId = (sessionId: string): void => {
  if (!SESSION_ID_REGEX.test(sessionId)) {
    throw new ValidationError(`Invalid session ID: "${sessionId}". Must match ${String(SESSION_ID_REGEX)}`);
  }
};

export const validatePromptSize = (prompt?: string): void => {
  if (!prompt) throw new ValidationError('Prompt is required');

  const bytes = Buffer.byteLength(prompt, 'utf-8');

  if (bytes > MAX_PROMPT_BYTES) {
    throw new ValidationError(`Prompt exceeds maximum size: ${bytes} bytes (limit: ${MAX_PROMPT_BYTES})`);
  }
};

export const validateWorkingDirectory = (dir: string): string => {
  return path.resolve(dir);
};

export const validateFiles = (files: readonly string[], workingDir: string): string[] => {
  if (files.length > MAX_FILES) {
    throw new ValidationError(`Too many files: ${files.length} (limit: ${MAX_FILES})`);
  }

  return files.map((file) => {
    const resolved = path.resolve(workingDir, file);

    const safeRoot = workingDir.endsWith(path.sep) ? workingDir : workingDir + path.sep;

    if (!resolved.startsWith(safeRoot) && resolved !== workingDir) {
      throw new ValidationError(`File path escapes working directory: "${file}"`);
    }

    return resolved;
  });
};
