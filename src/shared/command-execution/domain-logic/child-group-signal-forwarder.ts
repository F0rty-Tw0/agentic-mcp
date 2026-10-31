import process from 'node:process';

import type { SignalForwarderInput } from '../common';

const TERMINATION_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];

// CLI mode has no signal handlers; the server's graceful shutdown calls terminateAll itself.
export const installSignalForwarders = (input: SignalForwarderInput): void => {
  const { terminateAll, killAll, isShuttingDown } = input;
  const forwarders = new Map<NodeJS.Signals, () => void>();

  // Dying by a signal skips the exit hook, so anything still tracked is killed before the signal is re-raised.
  const killAllAndReraise = (signal: NodeJS.Signals): void => {
    killAll();
    forwarders.forEach((listener, forwardedSignal) => process.removeListener(forwardedSignal, listener));
    process.kill(process.pid, signal);
  };

  // A second signal during the grace period skips the wait instead of killing this process first.
  const forwardSignal = (signal: NodeJS.Signals): void => {
    const isSecondSignal = isShuttingDown();

    if (isSecondSignal) {
      killAllAndReraise(signal);

      return;
    }

    void terminateAll().then(() => {
      killAllAndReraise(signal);
    });
  };

  const installSignalForwarder = (signal: NodeJS.Signals): void => {
    const listenerCount = process.listenerCount(signal);
    const isHandledElsewhere = listenerCount > 0;

    if (isHandledElsewhere) return;

    const listener = (): void => {
      forwardSignal(signal);
    };

    forwarders.set(signal, listener);
    process.on(signal, listener);
  };

  TERMINATION_SIGNALS.forEach(installSignalForwarder);
};
