import type { ReviewToolArgs } from '../../ask/common';
import type { AskAllToolArgs } from '../../ask-all/common';

type ToolCallArgs = Readonly<Record<string, unknown>>;

export const isReviewToolArgs = (args: ToolCallArgs): args is ReviewToolArgs => typeof args.scope === 'string';

export const isAskAllToolArgs = (args: ToolCallArgs): args is AskAllToolArgs => typeof args.prompt === 'string';
