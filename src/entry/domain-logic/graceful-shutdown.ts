import { defaultChildGroupRegistry } from '../../shared';
import { SHUTDOWN_CLOSE_TIMEOUT_MS } from '../common';

type CloseFn = () => Promise<void>;

const closeServer = async (close: CloseFn): Promise<number> => {
  try {
    await close();
  } catch {
    return 1;
  }

  return 0;
};

const closeTimeout = async (): Promise<number> => {
  const timedOutCode = await new Promise<number>((resolve) => {
    setTimeout(resolve, SHUTDOWN_CLOSE_TIMEOUT_MS, 1);
  });

  return timedOutCode;
};

// Groups are stopped alongside close, since close can wait forever on a client that stopped reading.
export const registerGracefulShutdown = (close: CloseFn): void => {
  const handler = async (): Promise<void> => {
    const closed = Promise.race([closeServer(close), closeTimeout()]);
    const [exitCode] = await Promise.all([closed, defaultChildGroupRegistry.terminateAll()]);

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
