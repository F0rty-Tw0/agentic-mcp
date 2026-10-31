import { describe, expect, it } from 'vitest';

import { buildSkippedSkillResult, resolveSkillPath } from './client-skill.util';
import { DEFAULT_SKILL_PATH } from '../test/common/setup.const';

describe('client-skill utilities', () => {
  it('GIVEN a home directory WHEN resolving the skill path THEN it points to the using-agentic-mcp skill', () => {
    const skillPath = resolveSkillPath('/home/dev');

    expect(skillPath).toBe(DEFAULT_SKILL_PATH);
  });

  it('GIVEN a home directory WHEN building a skipped skill result THEN it names the path and the --yes reason', () => {
    const skippedResult = buildSkippedSkillResult('/home/dev');

    expect(skippedResult).toStrictEqual({
      status: 'skipped',
      skillPath: DEFAULT_SKILL_PATH,
      reason: 'rerun with --yes to install it',
    });
  });
});
