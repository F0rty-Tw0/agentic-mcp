import type { ClientConfigMergeResult } from './client-target.type';
import type { SetupPlanInput } from './setup.type';

export type PlanWarningsInput = {
  readonly input: SetupPlanInput;
  readonly targetPath: string | undefined;
  readonly isClaudeStateOverwrite: boolean;
  readonly isInvalidMerge: boolean;
  readonly mergedConfig: ClientConfigMergeResult;
};
