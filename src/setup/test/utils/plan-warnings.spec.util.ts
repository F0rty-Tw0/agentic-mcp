import type { ClientConfigMergeResult, PlanWarningsInput, SetupPlanInput } from '../../common';
import { DEFAULT_CLAUDE_PATH } from '../common/setup.const';
import { AGENTIC_SERVER_ENTRY_STUB } from '../stubs/setup-plan.stub';

export const createSetupPlanInput = (overrides: Partial<SetupPlanInput> = {}): SetupPlanInput => {
  const setupPlanInput: SetupPlanInput = {
    client: 'claude-code',
    homeDirectory: '/home/dev',
    pathOverride: undefined,
    mode: 'merge',
    dryRun: false,
    existingConfigText: undefined,
    agenticServerEntry: AGENTIC_SERVER_ENTRY_STUB,
    backup: 'if-exists',
    env: {},
    toolTimeout: undefined,
    ...overrides,
  };

  return setupPlanInput;
};

export const createClientConfigMergeResult = (
  overrides: Partial<ClientConfigMergeResult> = {}
): ClientConfigMergeResult => {
  const mergeResult: ClientConfigMergeResult = {
    status: 'merged',
    configText: '{}\n',
    notes: [],
    warnings: [],
    rewritten: false,
    rewriteCause: undefined,
    reason: undefined,
    ...overrides,
  };

  return mergeResult;
};

export const createPlanWarningsInput = (overrides: Partial<PlanWarningsInput> = {}): PlanWarningsInput => {
  const planWarningsInput: PlanWarningsInput = {
    input: createSetupPlanInput(),
    targetPath: DEFAULT_CLAUDE_PATH,
    isClaudeStateOverwrite: false,
    isInvalidMerge: false,
    mergedConfig: createClientConfigMergeResult(),
    ...overrides,
  };

  return planWarningsInput;
};
