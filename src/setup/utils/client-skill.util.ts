import path from 'node:path';

import { SKILL_CONSENT_REASON } from '../common';
import type { SkillInstallResult } from '../common';

export const resolveSkillPath = (homeDirectory: string): string => {
  const skillPath = path.join(homeDirectory, '.claude', 'skills', 'using-agentic-mcp', 'SKILL.md');

  return skillPath;
};

export const buildSkippedSkillResult = (homeDirectory: string): SkillInstallResult => {
  const skillPath = resolveSkillPath(homeDirectory);
  const skippedResult: SkillInstallResult = { status: 'skipped', skillPath, reason: SKILL_CONSENT_REASON };

  return skippedResult;
};
