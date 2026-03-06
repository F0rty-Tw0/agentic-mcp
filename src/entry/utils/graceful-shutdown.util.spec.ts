import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerGracefulShutdown } from './graceful-shutdown.util';

describe('registerGracefulShutdown', () => {
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

  it('GIVEN SIGINT fires WHEN handler runs THEN calls the close function', async () => {
    let sigintHandler: (() => void) | undefined;

    vi.spyOn(process, 'on').mockImplementation((event: string | symbol, handler: (...args: unknown[]) => void) => {
      if (event === 'SIGINT') sigintHandler = handler as () => void;

      return process;
    });

    const closeFn = vi.fn().mockResolvedValue(undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    registerGracefulShutdown(closeFn);
    await sigintHandler?.();

    expect(closeFn).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('GIVEN SIGTERM fires WHEN handler runs THEN calls the close function', async () => {
    let sigtermHandler: (() => void) | undefined;

    vi.spyOn(process, 'on').mockImplementation((event: string | symbol, handler: (...args: unknown[]) => void) => {
      if (event === 'SIGTERM') sigtermHandler = handler as () => void;

      return process;
    });

    const closeFn = vi.fn().mockResolvedValue(undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    registerGracefulShutdown(closeFn);
    await sigtermHandler?.();

    expect(closeFn).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('GIVEN close function throws WHEN signal fires THEN exits with code 1', async () => {
    let sigintHandler: (() => void) | undefined;

    vi.spyOn(process, 'on').mockImplementation((event: string | symbol, handler: (...args: unknown[]) => void) => {
      if (event === 'SIGINT') sigintHandler = handler as () => void;

      return process;
    });

    const closeFn = vi.fn().mockRejectedValue(new Error('close failed'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    registerGracefulShutdown(closeFn);
    await sigintHandler?.();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
