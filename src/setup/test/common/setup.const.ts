import path from 'node:path';

import type { DetectedProvider } from '../../common';

const CLAUDE_TEST_PROVIDER: DetectedProvider = {
  name: 'claude',
  available: true,
  binaryPath: '/usr/bin/claude',
};

export const TEST_PROVIDERS: DetectedProvider[] = [CLAUDE_TEST_PROVIDER];

export const DEFAULT_SKILL_PATH = '/home/dev/.claude/skills/using-agentic-mcp/SKILL.md';

export const DEFAULT_CLAUDE_PATH = path.join('/home/dev', '.claude.json');
