import { describe, expect, it } from 'vitest';

import { buildConsentPrompt, isConsentRequired, isNonInteractiveWriteBlocked } from './setup-consent.util';
import { createParsedSetupArgs, createSetupPlan } from '../test/utils/setup-cli-runner.spec.util';

describe('setup-consent utilities', () => {
  describe('isConsentRequired', () => {
    it('GIVEN a codex write plan WHEN checking consent THEN it is required', () => {
      const isRequired = isConsentRequired(createSetupPlan({ client: 'codex', writeIntent: 'write' }));

      expect(isRequired).toBe(true);
    });

    it('GIVEN an unchanged claude-code plan WHEN checking consent THEN it is required for the skill install', () => {
      const isRequired = isConsentRequired(createSetupPlan({ client: 'claude-code', writeIntent: 'unchanged' }));

      expect(isRequired).toBe(true);
    });

    it('GIVEN an unchanged codex plan WHEN checking consent THEN it is not required', () => {
      const isRequired = isConsentRequired(createSetupPlan({ client: 'codex', writeIntent: 'unchanged' }));

      expect(isRequired).toBe(false);
    });

    it('GIVEN a claude-code manual plan WHEN checking consent THEN it is not required', () => {
      const isRequired = isConsentRequired(createSetupPlan({ client: 'claude-code', writeIntent: 'manual' }));

      expect(isRequired).toBe(false);
    });
  });

  describe('isNonInteractiveWriteBlocked', () => {
    it('GIVEN non-interactive write without --yes WHEN checking block THEN returns true', () => {
      const isBlocked = isNonInteractiveWriteBlocked(
        createParsedSetupArgs({ yes: false }),
        createSetupPlan({ writeIntent: 'write' }),
        false
      );

      expect(isBlocked).toBe(true);
    });

    it('GIVEN non-interactive write with --yes WHEN checking block THEN returns false', () => {
      const isBlocked = isNonInteractiveWriteBlocked(
        createParsedSetupArgs({ yes: true }),
        createSetupPlan({ writeIntent: 'write' }),
        false
      );

      expect(isBlocked).toBe(false);
    });

    it('GIVEN a non-interactive unchanged codex plan without --yes WHEN checking block THEN returns false', () => {
      const isBlocked = isNonInteractiveWriteBlocked(
        createParsedSetupArgs({ client: 'codex', yes: false }),
        createSetupPlan({ client: 'codex', writeIntent: 'unchanged' }),
        false
      );

      expect(isBlocked).toBe(false);
    });
  });

  describe('buildConsentPrompt', () => {
    it('GIVEN a write plan WHEN building the prompt THEN it asks to write the config', () => {
      const prompt = buildConsentPrompt(createSetupPlan({ writeIntent: 'write', targetPath: '/tmp/mcp.json' }));

      expect(prompt).toBe('Write config to /tmp/mcp.json? [y/N] ');
    });

    it('GIVEN an unchanged claude-code plan WHEN building the prompt THEN it asks only to install the skill', () => {
      const plan = createSetupPlan({ writeIntent: 'unchanged', targetPath: '/tmp/mcp.json' });
      const prompt = buildConsentPrompt(plan);

      expect(prompt).toBe('agentic-mcp is already configured in /tmp/mcp.json. Install the Claude Code skill? [y/N] ');
    });
  });
});
