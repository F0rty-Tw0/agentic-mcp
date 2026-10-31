import { defaultChildGroupRegistry } from '../../shared';

type CloseFn = () => Promise<void>;

const closeServer = async (close: CloseFn): Promise<number> => {
  try {
    await close();
  } catch {
    return 1;
  }

  return 0;
};

// Provider groups ignoring SIGTERM get SIGKILL after a bounded grace period, before the process exits.
export const registerGracefulShutdown = (close: CloseFn): void => {
  const handler = async (): Promise<void> => {
    const exitCode = await closeServer(close);

    await defaultChildGroupRegistry.terminateAll();
    process.exit(exitCode);
  };

  process.on('SIGINT', () => {
    void handler();
  });
  process.on('SIGTERM', () => {
    void handler();
  });
  process.on('SIGHUP', () => {
    void handler();
  });
};
