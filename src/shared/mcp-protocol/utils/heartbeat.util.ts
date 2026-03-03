import { randomUUID } from 'node:crypto';

import type { ProgressContext, ProgressToken } from '../common';

const HEARTBEAT_INTERVAL_MS = 30_000;

const resolveProgressToken = (extra?: ProgressContext): ProgressToken | undefined => {
  if (!extra?.sendNotification) return;

  // eslint-disable-next-line no-underscore-dangle
  const providedToken = extra._meta?.progressToken;

  if (providedToken != null) return providedToken;

  return `agentic-mcp-heartbeat-${randomUUID()}`;
};

const sendHeartbeat = (
  extra: ProgressContext,
  progressToken: ProgressToken,
  progress: number,
  elapsedSeconds: number
): void => {
  const message = `Processing… (${elapsedSeconds}s elapsed)`;
  const params = {
    progressToken,
    progress,
    message,
  };

  extra
    .sendNotification({
      method: 'notifications/progress',
      params,
    })
    .catch(() => {
      /* notification failures are non-fatal */
    });
};

export const startHeartbeat = (extra?: ProgressContext): (() => void) => {
  const progressToken = resolveProgressToken(extra);

  if (!progressToken || !extra?.sendNotification) {
    return () => {
      /* empty */
    };
  }

  let progress = 0;

  sendHeartbeat(extra, progressToken, progress, 0);

  const timer = setInterval(() => {
    progress++;

    sendHeartbeat(extra, progressToken, progress, progress * (HEARTBEAT_INTERVAL_MS / 1000));
  }, HEARTBEAT_INTERVAL_MS);

  return () => clearInterval(timer);
};
