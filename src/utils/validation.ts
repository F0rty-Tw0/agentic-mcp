import path from 'node:path';

import { ValidationError } from '../common/errors/validation-error.ts';
import {
  MAX_CONTEXT_BYTES,
  MAX_FILES,
  MAX_PROMPT_BYTES,
} from '../common/execution-limits.const.ts';
import { MODEL_REGEX, SESSION_ID_REGEX } from '../common/validation-patterns.const.ts';

export function validateModel(model: string): void {
  if (!MODEL_REGEX.test(model)) {
    throw new ValidationError(
      `Invalid model identifier: "${model}". Must match ${String(MODEL_REGEX)}`,
    );
  }
}

export function validateSessionId(sessionId: string): void {
  if (!SESSION_ID_REGEX.test(sessionId)) {
    throw new ValidationError(
      `Invalid session ID: "${sessionId}". Must match ${String(SESSION_ID_REGEX)}`,
    );
  }
}

export function validatePromptSize(prompt: string): void {
  const bytes = Buffer.byteLength(prompt, 'utf-8');

  if (bytes > MAX_PROMPT_BYTES) {
    throw new ValidationError(
      `Prompt exceeds maximum size: ${bytes} bytes (limit: ${MAX_PROMPT_BYTES})`,
    );
  }
}

export function validateContextSize(context: string): void {
  const bytes = Buffer.byteLength(context, 'utf-8');

  if (bytes > MAX_CONTEXT_BYTES) {
    throw new ValidationError(
      `Context exceeds maximum size: ${bytes} bytes (limit: ${MAX_CONTEXT_BYTES})`,
    );
  }
}

export function validateWorkingDirectory(dir: string): string {
  if (dir.includes('..')) {
    throw new ValidationError(
      `Working directory must not contain path traversal: "${dir}"`,
    );
  }

  return path.resolve(dir);
}

export function validateFiles(
  files: readonly string[],
  workingDir: string,
): string[] {
  if (files.length > MAX_FILES) {
    throw new ValidationError(
      `Too many files: ${files.length} (limit: ${MAX_FILES})`,
    );
  }

  return files.map((file) => {
    const resolved = path.resolve(workingDir, file);

    if (!resolved.startsWith(workingDir)) {
      throw new ValidationError(
        `File path escapes working directory: "${file}"`,
      );
    }

    return resolved;
  });
}
