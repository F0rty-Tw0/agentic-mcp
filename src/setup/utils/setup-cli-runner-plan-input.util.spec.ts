import { describe, expect, it, vi } from 'vitest';

import { runConfiguredSetup } from './setup-cli-runner.util';
import type { ProviderConfig, ProvidersFile } from '../../shared/provider/common';
import { TEST_PROVIDER_CONFIG_STUB } from '../../shared/provider/test/stubs';
import type { McpServerEntry, SetupEnv } from '../common';
import { TEST_PROVIDERS } from '../test/common/setup.const';
import {
  createParsedSetupArgs,
  createSetupCliDependencies,
  createSetupPlan,
} from '../test/utils/setup-cli-runner.spec.util';

const TEST_SERVER_ENTRY: McpServerEntry = { command: 'npx', args: ['-y', 'agentic-mcp'] };

const SLOW_PROVIDER: ProviderConfig = { ...TEST_PROVIDER_CONFIG_STUB, timeout: 5_400_000, queueTimeoutMs: 1_200_000 };

const SLOW_PROVIDERS = { slow: SLOW_PROVIDER };

const SLOW_PROVIDERS_FILE: ProvidersFile = { configVersion: 1, providers: SLOW_PROVIDERS };

describe('FEATURE: setup plan input from the CLI runner', () => {
  describe('GIVEN the process environment', () => {
    it('WHEN running configured setup THEN the plan receives it', async () => {
      const env: SetupEnv = Object.fromEntries([['CODEX_HOME', '/srv/codex']]);
      const buildSetupPlan = vi.fn(() => createSetupPlan({ client: 'codex' }));
      const dependencies = createSetupCliDependencies({ buildSetupPlan, env });

      await runConfiguredSetup({
        parsedArgs: createParsedSetupArgs({ client: 'codex' }),
        dependencies,
        detectedProviders: TEST_PROVIDERS,
      });

      expect(buildSetupPlan).toHaveBeenCalledWith(expect.objectContaining({ env }));
    });
  });

  describe('GIVEN a providers config with a 90 min provider and a 20 min queue wait', () => {
    it('WHEN running configured setup THEN the entry gets their sum plus one minute', async () => {
      const generateClientConfigEntry = vi.fn(() => TEST_SERVER_ENTRY);
      const loadProvidersConfig = async (): Promise<ProvidersFile> => Promise.resolve(SLOW_PROVIDERS_FILE);
      const dependencies = createSetupCliDependencies({ generateClientConfigEntry, loadProvidersConfig });

      await runConfiguredSetup({
        parsedArgs: createParsedSetupArgs({ client: 'gemini' }),
        dependencies,
        detectedProviders: TEST_PROVIDERS,
      });

      expect(generateClientConfigEntry).toHaveBeenCalledWith('gemini', TEST_PROVIDERS, 6_660_000);
    });

    it('WHEN running configured setup THEN the plan gets where the value came from', async () => {
      const buildSetupPlan = vi.fn(() => createSetupPlan({ client: 'gemini' }));
      const loadProvidersConfig = async (): Promise<ProvidersFile> => Promise.resolve(SLOW_PROVIDERS_FILE);
      const dependencies = createSetupCliDependencies({ buildSetupPlan, loadProvidersConfig });
      const toolTimeout = { ms: 6_660_000, runMs: 5_400_000, queueMs: 1_200_000, source: 'providers-config' };

      await runConfiguredSetup({
        parsedArgs: createParsedSetupArgs({ client: 'gemini' }),
        dependencies,
        detectedProviders: TEST_PROVIDERS,
      });

      expect(buildSetupPlan).toHaveBeenCalledWith(expect.objectContaining({ toolTimeout }));
    });
  });

  describe('GIVEN a providers config that cannot be loaded', () => {
    it('WHEN running configured setup THEN the entry gets the default 71 min', async () => {
      const generateClientConfigEntry = vi.fn(() => TEST_SERVER_ENTRY);
      const loadProvidersConfig = async (): Promise<ProvidersFile> => Promise.reject(new Error('ENOENT'));
      const dependencies = createSetupCliDependencies({ generateClientConfigEntry, loadProvidersConfig });

      await runConfiguredSetup({
        parsedArgs: createParsedSetupArgs({ client: 'gemini' }),
        dependencies,
        detectedProviders: TEST_PROVIDERS,
      });

      expect(generateClientConfigEntry).toHaveBeenCalledWith('gemini', TEST_PROVIDERS, 4_260_000);
    });

    it('WHEN running configured setup THEN the fallback reason names the load error', async () => {
      const buildSetupPlan = vi.fn(() => createSetupPlan({ client: 'gemini' }));
      const loadProvidersConfig = async (): Promise<ProvidersFile> =>
        Promise.reject(new Error('ENOENT: no such file\n    at open'));
      const dependencies = createSetupCliDependencies({ buildSetupPlan, loadProvidersConfig });
      const fallbackReason = 'the providers config could not be loaded (ENOENT: no such file)';

      await runConfiguredSetup({
        parsedArgs: createParsedSetupArgs({ client: 'gemini' }),
        dependencies,
        detectedProviders: TEST_PROVIDERS,
      });

      const toolTimeout: unknown = expect.objectContaining({ fallbackReason });

      expect(buildSetupPlan).toHaveBeenCalledWith(expect.objectContaining({ toolTimeout }));
    });
  });
});
