import { vi } from 'vitest';

import type { IdleTimeoutHandle, ResultExitWatch } from '../../common';

export const idleTimeoutHandleMock = (): IdleTimeoutHandle => {
  const idleTimeout: IdleTimeoutHandle = { reset: vi.fn(), clear: vi.fn(), timedOut: vi.fn(() => false) };

  return idleTimeout;
};

export const resultExitWatchMock = (): ResultExitWatch => {
  const resultExitWatch: ResultExitWatch = { observe: vi.fn(), clear: vi.fn(), stopped: vi.fn(() => false) };

  return resultExitWatch;
};
