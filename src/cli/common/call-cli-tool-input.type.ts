import type { Progress } from '@modelcontextprotocol/sdk/types.js';

import type { AskToolArgs } from '../../ask';
import type { AskAllToolArgs } from '../../ask-all';

export type CallCliToolInput = Readonly<{
  toolName: string;
  args: AskToolArgs | AskAllToolArgs;
  configPath?: string;
  onProgress?: (progress: Progress) => void;
}>;
