type CloseFn = () => Promise<void>;

export const registerGracefulShutdown = (close: CloseFn): void => {
  const handler = async (): Promise<void> => {
    try {
      await close();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  };

  process.on('SIGINT', () => { void handler(); });
  process.on('SIGTERM', () => { void handler(); });
};
