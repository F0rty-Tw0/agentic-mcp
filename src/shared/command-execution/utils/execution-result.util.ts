import type {
  ExecutionResult,
  ExecutionTimeoutCause,
  ResolveExecutionResultInput,
  ResolveTimeoutCauseInput,
} from '../common';

const resolveStopCause = (input: ResolveTimeoutCauseInput): ExecutionTimeoutCause | undefined => {
  const { wallClockTimedOut, idleTimedOut, resultExitStopped, timeoutMs, idleTimeoutMs } = input;

  if (resultExitStopped) {
    const resultExitCause: ExecutionTimeoutCause = { kind: 'result-exit', limitMs: 0 };

    return resultExitCause;
  }

  if (wallClockTimedOut) {
    const wallClockCause: ExecutionTimeoutCause = { kind: 'wall-clock', limitMs: timeoutMs };

    return wallClockCause;
  }

  if (!idleTimedOut || idleTimeoutMs === undefined) return;

  const idleCause: ExecutionTimeoutCause = { kind: 'idle', limitMs: idleTimeoutMs };

  return idleCause;
};

export const resolveTimeoutCause = (input: ResolveTimeoutCauseInput): ExecutionTimeoutCause | undefined => {
  const stopCause = resolveStopCause(input);

  if (stopCause === undefined || !input.exitedBeforeKill) return stopCause;

  const heldOutputCause: ExecutionTimeoutCause = { ...stopCause, outputHeldAfterExit: true };

  return heldOutputCause;
};

export const resolveExecutionResult = (input: ResolveExecutionResultInput): ExecutionResult => {
  const { stdout, stderr, exitCode, closeSignal, timeoutCause, executionTimeMs } = input;

  const executionResult: ExecutionResult = {
    stdout: stdout.output(),
    stderr: stderr.output(),
    exitCode,
    signal: closeSignal,
    timedOut: timeoutCause !== undefined,
    timeoutCause,
    truncated: stdout.truncated() || stderr.truncated(),
    stdoutBytes: stdout.bytes(),
    stderrBytes: stderr.bytes(),
    executionTimeMs,
  };

  return executionResult;
};
