import type { Progress } from '@modelcontextprotocol/sdk/types.js';

import type { AskToolArgs, ReviewToolArgs } from '../../ask/common';
import type { AskAllToolArgs } from '../../ask-all/common';

export type CallCliToolInput = {
  readonly toolName: string;
  readonly args: AskToolArgs | AskAllToolArgs | ReviewToolArgs;
  readonly configPath?: string;
  readonly onProgress?: (progress: Progress) => void;
};
