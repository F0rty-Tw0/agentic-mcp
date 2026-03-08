import { ValidationError } from '../../validation/common';

const MIN_ALLOWED_VALUE = 0;
const BACKOFF_BASE = 2;

type RetryOperation<T> = () => Promise<T> | T;

export type RetryWithExponentialBackoffInput<T> = Readonly<{
  operation: RetryOperation<T>;
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
}>;

const sleep = async (delayMs: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
};

const validateInputNumber = (name: string, value: number): void => {
  if (!Number.isInteger(value) || value < MIN_ALLOWED_VALUE) {
    throw new ValidationError(`${name} must be a non-negative integer.`);
  }
};

const validateRetryInput = <T>(input: RetryWithExponentialBackoffInput<T>): void => {
  validateInputNumber('maxRetries', input.maxRetries);
  validateInputNumber('initialDelayMs', input.initialDelayMs);
  validateInputNumber('maxDelayMs', input.maxDelayMs);
};

const normalizeUnknownError = (error: unknown): Error => {
  if (error instanceof Error) return error;

  const fallbackError = new Error('Retry operation failed with a non-Error value.', {
    cause: error,
  });

  return fallbackError;
};

const calculateDelay = (attemptIndex: number, initialDelayMs: number, maxDelayMs: number): number => {
  const exponentialDelay = initialDelayMs * BACKOFF_BASE ** attemptIndex;
  const boundedDelay = Math.min(exponentialDelay, maxDelayMs);

  return boundedDelay;
};

export const retryWithExponentialBackoff = async <T>(
  retryWithExponentialBackoffInput: RetryWithExponentialBackoffInput<T>
): Promise<T> => {
  validateRetryInput(retryWithExponentialBackoffInput);
  const { operation, maxRetries, initialDelayMs, maxDelayMs } = retryWithExponentialBackoffInput;
  let attemptIndex = 0;

  while (attemptIndex <= maxRetries) {
    try {
      const result = await operation();

      return result;
    } catch (error: unknown) {
      const normalizedError = normalizeUnknownError(error);

      if (attemptIndex === maxRetries) throw normalizedError;

      const delayMs = calculateDelay(attemptIndex, initialDelayMs, maxDelayMs);

      await sleep(delayMs);
      attemptIndex += 1;
    }
  }

  throw new ValidationError('Retry loop finished unexpectedly.');
};
