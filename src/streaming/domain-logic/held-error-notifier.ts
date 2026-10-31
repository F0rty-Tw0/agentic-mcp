import type { AskStreamExecutionSummary, HeldErrorStreamNotifier, StreamNotifier } from '../common';

type HeldError = {
  readonly error: string;
  readonly summary?: AskStreamExecutionSummary;
};

// The terminal error waits for releaseError, so a run its caller retries never ends the stream with an error.
// Queued chunks still go out when the error is held, as they did when it was sent.
export const holdStreamError = (streamNotifier: StreamNotifier): HeldErrorStreamNotifier => {
  let heldError: HeldError | undefined;

  const notifier: StreamNotifier = {
    ...streamNotifier,
    emitError: (error: string, summary?: AskStreamExecutionSummary): void => {
      streamNotifier.flush();
      heldError = { error, summary };
    },
  };
  const releaseError = (): void => {
    if (!heldError) return;

    streamNotifier.emitError(heldError.error, heldError.summary);
    heldError = undefined;
  };
  const heldErrorNotifier: HeldErrorStreamNotifier = { notifier, releaseError };

  return heldErrorNotifier;
};
