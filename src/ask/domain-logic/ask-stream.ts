import { startAskHeartbeat } from './ask-heartbeat';
import type { ProgressContext } from '../../shared/mcp-protocol/common';
import type { ResolvedProviderEntry } from '../../shared/provider/common';
import { createStreamNotifier } from '../../streaming';
import type { StreamNotifier } from '../../streaming/common';
import type { AskToolArgs } from '../common';

type AskStreamInput = {
  readonly context: ResolvedProviderEntry;
  readonly args: AskToolArgs;
  readonly extra?: ProgressContext;
};

type AskStreamRun<T> = (streamNotifier: StreamNotifier) => Promise<T>;

// One notifier and one heartbeat per tool call: MCP needs progress to rise for one progressToken, so a CLI run the
// session flow retries continues the call's stream id and sequence instead of starting its own.
export const withAskStream = async <T>(askStreamInput: AskStreamInput, run: AskStreamRun<T>): Promise<T> => {
  const { context, args, extra } = askStreamInput;
  const streamNotifier = createStreamNotifier({ providerName: context.name, args, extra });
  const stopHeartbeat = startAskHeartbeat(streamNotifier, extra);

  try {
    const result = await run(streamNotifier);

    return result;
  } finally {
    stopHeartbeat();
    streamNotifier.stop();
  }
};
