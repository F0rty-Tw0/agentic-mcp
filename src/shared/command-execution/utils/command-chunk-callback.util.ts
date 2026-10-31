import type { IdleTimeoutHandle, ResultExitWatch, StreamChunkCallback } from '../common';

export const wrapChunkCallback = (
  idleTimeout: IdleTimeoutHandle,
  callback?: StreamChunkCallback
): StreamChunkCallback => {
  return (chunk: string): void => {
    idleTimeout.reset();
    callback?.(chunk);
  };
};

export const wrapStdoutCallback = (
  idleTimeout: IdleTimeoutHandle,
  resultExitWatch: ResultExitWatch,
  callback?: StreamChunkCallback
): StreamChunkCallback => {
  return (chunk: string): void => {
    idleTimeout.reset();
    resultExitWatch.observe(chunk);
    callback?.(chunk);
  };
};
