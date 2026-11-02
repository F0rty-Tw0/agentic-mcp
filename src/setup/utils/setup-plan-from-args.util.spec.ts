import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildSetupPlanFromArgs } from './setup-plan-from-args.util';
import type { ProvidersFile } from '../../shared/provider/common';
import type { ParsedSetupArgs, SetupCliDependencies, SetupPlan, SetupPlanInput } from '../common';
import { DEFAULT_CLAUDE_PATH, TEST_PROVIDERS } from '../test/common/setup.const';
import { AGENTIC_SERVER_ENTRY_STUB } from '../test/stubs/setup-plan.stub';
import {
  createParsedSetupArgs,
  createSetupCliDependencies,
  createSetupPlan,
} from '../test/utils/setup-cli-runner.spec.util';

type PlanBuilder = (input: SetupPlanInput) => SetupPlan;

type ConfigReader = SetupCliDependencies['readConfigFile'];

const EXISTING_CONFIG_TEXT = '{"mcpServers":{}}';

const buildFromArgs = async (parsedArgs: ParsedSetupArgs, dependencies: SetupCliDependencies): Promise<SetupPlan> => {
  const plan = await buildSetupPlanFromArgs({ parsedArgs, dependencies, detectedProviders: TEST_PROVIDERS });

  return plan;
};

describe('FEATURE: setup plan from parsed CLI args', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GIVEN claude-code without --path', () => {
    it('WHEN building the plan THEN it reads the default client config', async () => {
      const readConfigFile = vi.fn<ConfigReader>().mockResolvedValue(EXISTING_CONFIG_TEXT);
      const dependencies = createSetupCliDependencies({ readConfigFile });

      await buildFromArgs(createParsedSetupArgs(), dependencies);

      expect(readConfigFile).toHaveBeenCalledWith(DEFAULT_CLAUDE_PATH);
    });

    it('WHEN building the plan THEN the plan input carries the args, the entry and the existing config', async () => {
      const buildSetupPlan = vi.fn<PlanBuilder>(() => createSetupPlan());
      const dependencies = createSetupCliDependencies({ buildSetupPlan });
      const parsedArgs = createParsedSetupArgs({ mode: 'overwrite', dryRun: true, backup: 'never' });
      const expectedInput = {
        client: 'claude-code',
        homeDirectory: '/home/dev',
        pathOverride: undefined,
        mode: 'overwrite',
        dryRun: true,
        existingConfigText: EXISTING_CONFIG_TEXT,
        agenticServerEntry: AGENTIC_SERVER_ENTRY_STUB,
        backup: 'never',
        env: {},
      };

      await buildFromArgs(parsedArgs, dependencies);

      expect(buildSetupPlan).toHaveBeenCalledWith(expect.objectContaining(expectedInput));
    });

    it('WHEN building the plan THEN it returns the plan the builder made', async () => {
      const builtPlan = createSetupPlan({ notes: ['built'] });
      const dependencies = createSetupCliDependencies({ buildSetupPlan: () => builtPlan });

      const plan = await buildFromArgs(createParsedSetupArgs(), dependencies);

      expect(plan).toBe(builtPlan);
    });
  });

  describe('GIVEN a --path override', () => {
    it('WHEN building the plan THEN it reads the override path', async () => {
      const readConfigFile = vi.fn<ConfigReader>().mockResolvedValue(EXISTING_CONFIG_TEXT);
      const dependencies = createSetupCliDependencies({ readConfigFile });

      await buildFromArgs(createParsedSetupArgs({ pathOverride: '/tmp/custom.json' }), dependencies);

      expect(readConfigFile).toHaveBeenCalledWith('/tmp/custom.json');
    });
  });

  describe('GIVEN the generic client without --path', () => {
    it('WHEN building the plan THEN it reads no config file', async () => {
      const readConfigFile = vi.fn<ConfigReader>().mockResolvedValue(EXISTING_CONFIG_TEXT);
      const dependencies = createSetupCliDependencies({ readConfigFile });

      await buildFromArgs(createParsedSetupArgs({ client: 'generic' }), dependencies);

      expect(readConfigFile).not.toHaveBeenCalled();
    });

    it('WHEN building the plan THEN the plan input has no existing config', async () => {
      const buildSetupPlan = vi.fn<PlanBuilder>(() => createSetupPlan({ client: 'generic' }));
      const dependencies = createSetupCliDependencies({ buildSetupPlan });

      await buildFromArgs(createParsedSetupArgs({ client: 'generic' }), dependencies);

      expect(buildSetupPlan).toHaveBeenCalledWith(expect.objectContaining({ existingConfigText: undefined }));
    });
  });

  describe('GIVEN a providers config load that rejects with a non-Error value', () => {
    it('WHEN building the plan THEN the fallback reason has no cause in parentheses', async () => {
      const buildSetupPlan = vi.fn<PlanBuilder>(() => createSetupPlan());
      const loadProvidersConfig = vi.fn<() => Promise<ProvidersFile>>().mockRejectedValue('boom');
      const dependencies = createSetupCliDependencies({ buildSetupPlan, loadProvidersConfig });
      const fallbackReason = 'the providers config could not be loaded';
      const toolTimeout: unknown = expect.objectContaining({ source: 'defaults', fallbackReason });

      await buildFromArgs(createParsedSetupArgs(), dependencies);

      expect(buildSetupPlan).toHaveBeenCalledWith(expect.objectContaining({ toolTimeout }));
    });
  });

  describe('GIVEN a providers config that loads', () => {
    it('WHEN building the plan THEN the tool timeout comes from the providers config', async () => {
      const buildSetupPlan = vi.fn<PlanBuilder>(() => createSetupPlan());
      const dependencies = createSetupCliDependencies({ buildSetupPlan });
      const toolTimeout: unknown = expect.objectContaining({ source: 'providers-config' });

      await buildFromArgs(createParsedSetupArgs(), dependencies);

      expect(buildSetupPlan).toHaveBeenCalledWith(expect.objectContaining({ toolTimeout }));
    });
  });
});
