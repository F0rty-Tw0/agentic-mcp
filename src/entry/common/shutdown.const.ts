// A client that stopped reading can leave close() waiting on a stdout drain forever.
export const SHUTDOWN_CLOSE_TIMEOUT_MS = 5000;
