import { describe, expect, it } from 'vitest';

import { SKILL_CONTENT } from './skill-content';

describe('SKILL_CONTENT', () => {
  it('GIVEN installed skill WHEN documenting command coverage THEN it includes setup and all supported command families', () => {
    const requiredCommands = [
      'agentic-mcp setup',
      'agentic-mcp init',
      '`list_providers`',
      '`ping_<provider>`',
      '`help_<provider>`',
      '`ask_<provider>`',
      '`ask_all`',
      '`sessions_<provider>`',
      '`provider_metrics`',
    ];

    for (const requiredCommand of requiredCommands) {
      expect(SKILL_CONTENT).toContain(requiredCommand);
    }
  });

  it('GIVEN installed skill WHEN describing command choice THEN it explains what to use and when', () => {
    const expectedGuidance = [
      'Need to discover detected providers',
      'Need limited proof for one provider',
      'Need to inspect provider-specific capabilities',
      'Need one provider to answer a task',
      'Need to compare providers on the same prompt',
      'Need to resume or inspect multi-turn work',
      'Need usage and reliability metrics',
    ];

    for (const guidanceLine of expectedGuidance) {
      expect(SKILL_CONTENT).toContain(guidanceLine);
    }
  });

  it('GIVEN installed skill WHEN showing CLI fallbacks THEN it documents the important command flags', () => {
    const expectedFlags = [
      '--file <path>',
      '--context <text>',
      '--stream-live',
      '--providers <list>',
      '--async',
      '--job-id <id>',
      '--session-id <id>',
      '--model <name>',
      '--minimal',
    ];

    for (const expectedFlag of expectedFlags) {
      expect(SKILL_CONTENT).toContain(expectedFlag);
    }
  });
});
