import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_MINIMAL_ENV_STUB } from '../common/stubs';
import { createControllableChild } from '../common/test-utils/controllable-child';

vi.mock('cross-spawn', () => ({ default: vi.fn() }));
vi.mock('../utils/platform.util', () => ({ killProcess: vi.fn().mockResolvedValue(true) }));

const { default: crossSpawn } = await import('cross-spawn');
const { executeCommand } = await import('./command-executor');

const baseOptions = {
  binaryPath: '/usr/bin/test-cli',
  args: ['run'],
  env: TEST_MINIMAL_ENV_STUB,
  timeoutMs: 5_000,
  bypassSemaphore: false,
};

const drainMicrotasks = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('executeCommand semaphore concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GIVEN 5 in-flight commands WHEN a 6th is queued THEN it waits until a slot is released', async () => {
    const children = Array.from({ length: 6 }, () => createControllableChild());
    let callIndex = 0;

    vi.mocked(crossSpawn).mockImplementation(() => {
      const child = children[callIndex];
      const resolvedChild = child ?? children[0];

      callIndex += 1;

      expect(resolvedChild).toBeDefined();

      return resolvedChild?.child as unknown as ReturnType<typeof crossSpawn>;
    });

    const runCommand = async (): Promise<Awaited<ReturnType<typeof executeCommand>>> => executeCommand(baseOptions);
    const promises = Array.from({ length: 6 }, runCommand);

    await drainMicrotasks();
    expect(crossSpawn).toHaveBeenCalledTimes(5);

    children[0]?.emitClose(0, null);

    await drainMicrotasks();
    expect(crossSpawn).toHaveBeenCalledTimes(6);

    children.slice(1).forEach((child) => {
      child.emitClose(0, null);
    });

    await Promise.all(promises);
  });
});
