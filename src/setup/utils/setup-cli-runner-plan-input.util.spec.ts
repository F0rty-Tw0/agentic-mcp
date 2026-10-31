import { describe, expect, it, vi } from 'vitest';

import { runConfiguredSetup } from './setup-cli-runner.util';
import type { SetupEnv } from '../common';
import { TEST_PROVIDERS } from '../test/common/setup.const';
import {
  createParsedSetupArgs,
  createSetupCliDependencies,
  createSetupPlan,
} from '../test/utils/setup-cli-runner.spec.util';

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
});
