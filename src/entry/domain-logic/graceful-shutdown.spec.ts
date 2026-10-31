import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerGracefulShutdown } from './graceful-shutdown';
import { defaultChildGroupRegistry } from '../../shared';

type SignalHandler = () => unknown | Promise<void>;

const captureHandler = (signal: string): (() => SignalHandler) => {
  let captured: SignalHandler = () => undefined;

  vi.spyOn(process, 'on').mockImplementation((event: string | symbol, handler: (...args: unknown[]) => void) => {
    if (event === signal) captured = handler;

    return process;
  });

  const readHandler = (): SignalHandler => captured;

  return readHandler;
};

// The registered listener only starts the async shutdown, so the test waits for its promise chain to drain.
const flushShutdown = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
};

describe('registerGracefulShutdown', () => {
  beforeEach(() => {
    vi.spyOn(defaultChildGroupRegistry, 'terminateAll').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GIVEN a close function WHEN registerGracefulShutdown is called THEN registers SIGINT handler', () => {
    const onSpy = vi.spyOn(process, 'on').mockImplementation(() => process);
    const closeFn = vi.fn().mockResolvedValue(undefined);

    registerGracefulShutdown(closeFn);

    const sigintCall = onSpy.mock.calls.find((call) => call[0] === 'SIGINT');

    expect(sigintCall).toBeDefined();
  });

  it('GIVEN a close function WHEN registerGracefulShutdown is called THEN registers SIGTERM handler', () => {
    const onSpy = vi.spyOn(process, 'on').mockImplementation(() => process);
    const closeFn = vi.fn().mockResolvedValue(undefined);

    registerGracefulShutdown(closeFn);

    const sigtermCall = onSpy.mock.calls.find((call) => call[0] === 'SIGTERM');

    expect(sigtermCall).toBeDefined();
  });

  it('GIVEN a close function WHEN registerGracefulShutdown is called THEN registers a SIGHUP handler so detached CLI groups are stopped on hangup', () => {
    const onSpy = vi.spyOn(process, 'on').mockImplementation(() => process);
    const closeFn = vi.fn().mockResolvedValue(undefined);

    registerGracefulShutdown(closeFn);

    const sighupCall = onSpy.mock.calls.find((call) => call[0] === 'SIGHUP');

    expect(sighupCall).toBeDefined();
  });

  it('GIVEN SIGINT fires WHEN handler runs THEN calls the close function', async () => {
    let sigintHandler: () => unknown | Promise<void> = () => undefined;

    vi.spyOn(process, 'on').mockImplementation((event: string | symbol, handler: (...args: unknown[]) => void) => {
      if (event === 'SIGINT') sigintHandler = handler;

      return process;
    });

    const closeFn = vi.fn().mockResolvedValue(undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    registerGracefulShutdown(closeFn);
    await sigintHandler();
    await flushShutdown();

    expect(closeFn).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('GIVEN SIGTERM fires WHEN handler runs THEN calls the close function', async () => {
    let sigtermHandler: () => unknown | Promise<void> = () => undefined;

    vi.spyOn(process, 'on').mockImplementation((event: string | symbol, handler: (...args: unknown[]) => void) => {
      if (event === 'SIGTERM') sigtermHandler = handler as () => void;

      return process;
    });

    const closeFn = vi.fn().mockResolvedValue(undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    registerGracefulShutdown(closeFn);
    await sigtermHandler();
    await flushShutdown();

    expect(closeFn).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('GIVEN close function throws WHEN signal fires THEN exits with code 1', async () => {
    let sigintHandler: () => unknown | Promise<void> = () => undefined;

    vi.spyOn(process, 'on').mockImplementation((event: string | symbol, handler: (...args: unknown[]) => void) => {
      if (event === 'SIGINT') sigintHandler = handler as () => void;

      return process;
    });

    const closeFn = vi.fn().mockRejectedValue(new Error('close failed'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    registerGracefulShutdown(closeFn);
    await sigintHandler();
    await flushShutdown();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('GIVEN SIGTERM fires WHEN handler runs THEN provider groups are terminated before the process exits', async () => {
    const readHandler = captureHandler('SIGTERM');
    const terminateSpy = vi.mocked(defaultChildGroupRegistry.terminateAll);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    registerGracefulShutdown(vi.fn().mockResolvedValue(undefined));
    await readHandler()();
    await flushShutdown();

    expect(terminateSpy).toHaveBeenCalledBefore(exitSpy);
  });

  it('GIVEN close function throws WHEN signal fires THEN provider groups are still terminated', async () => {
    const readHandler = captureHandler('SIGINT');
    const terminateSpy = vi.mocked(defaultChildGroupRegistry.terminateAll);

    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    registerGracefulShutdown(vi.fn().mockRejectedValue(new Error('close failed')));
    await readHandler()();
    await flushShutdown();

    expect(terminateSpy).toHaveBeenCalledOnce();
  });
});
