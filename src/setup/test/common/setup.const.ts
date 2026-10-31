import path from 'node:path';

import type { ProvidersFile } from '../../../shared/provider/common';
import { TEST_PROVIDER_CONFIG_STUB } from '../../../shared/provider/test/stubs/provider-config.stub';
import type { DetectedProvider } from '../../common';

const CLAUDE_TEST_PROVIDER: DetectedProvider = {
  name: 'claude',
  available: true,
  binaryPath: '/usr/bin/claude',
};

export const TEST_PROVIDERS: DetectedProvider[] = [CLAUDE_TEST_PROVIDER];

export const DEFAULT_SKILL_PATH = '/home/dev/.claude/skills/using-agentic-mcp/SKILL.md';

export const DEFAULT_CLAUDE_PATH = path.join('/home/dev', '.claude.json');

const TEST_PROVIDER_CONFIGS = { test: TEST_PROVIDER_CONFIG_STUB };

export const TEST_PROVIDERS_FILE: ProvidersFile = { configVersion: 1, providers: TEST_PROVIDER_CONFIGS };
