import { startHeartbeat } from '../../shared';
import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { StreamNotifier } from '../../streaming/common';
import { noop } from '../common';

type StopHeartbeat = () => void;

export const startAskHeartbeat = (streamNotifier: StreamNotifier, extra?: ProgressContext): StopHeartbeat => {
  if (streamNotifier.enabled) return noop;

  const stopHeartbeat = startHeartbeat(extra);

  return stopHeartbeat;
};
