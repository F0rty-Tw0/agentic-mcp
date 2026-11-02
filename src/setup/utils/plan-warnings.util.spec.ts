import { describe, expect, it } from 'vitest';

import { buildPlanWarnings } from './plan-warnings.util';
import type { SetupMergeStatus, TomlRewriteCause } from '../common';
import { DEFAULT_CLAUDE_PATH } from '../test/common/setup.const';
import { CODEX_CONFIG_PATH_STUB } from '../test/stubs/setup-plan.stub';
import {
  createClientConfigMergeResult,
  createPlanWarningsInput,
  createSetupPlanInput,
} from '../test/utils/plan-warnings.spec.util';

const KEPT_NOTE = 'so its comments and formatting are not kept (the backup has the original unless --backup never).';

const buildCodexRewriteWarnings = (rewriteCause: TomlRewriteCause): string[] => {
  const mergedConfig = createClientConfigMergeResult({ rewritten: true, rewriteCause });
  const input = createSetupPlanInput({ client: 'codex' });
  const planWarningsInput = createPlanWarningsInput({ input, targetPath: CODEX_CONFIG_PATH_STUB, mergedConfig });
  const warnings = buildPlanWarnings(planWarningsInput);

  return warnings;
};

const buildInvalidMergeWarnings = (status: SetupMergeStatus): string[] => {
  const mergedConfig = createClientConfigMergeResult({ status, reason: 'bad shape' });
  const planWarningsInput = createPlanWarningsInput({ isInvalidMerge: true, mergedConfig });
  const warnings = buildPlanWarnings(planWarningsInput);

  return warnings;
};

describe('FEATURE: setup plan warnings', () => {
  describe('GIVEN a clean merge into a known path', () => {
    it('WHEN building warnings THEN there are none', () => {
      const warnings = buildPlanWarnings(createPlanWarningsInput());

      expect(warnings).toStrictEqual([]);
    });
  });

  describe('GIVEN the generic client', () => {
    it('WHEN it has no target path THEN it asks for --path', () => {
      const input = createSetupPlanInput({ client: 'generic' });
      const warnings = buildPlanWarnings(createPlanWarningsInput({ input, targetPath: undefined }));

      expect(warnings).toStrictEqual(['No writable path for generic client. Use --path to write directly.']);
    });

    it('WHEN --path gave it a target path THEN there is no path warning', () => {
      const input = createSetupPlanInput({ client: 'generic', pathOverride: '/tmp/mcp.json' });
      const warnings = buildPlanWarnings(createPlanWarningsInput({ input, targetPath: '/tmp/mcp.json' }));

      expect(warnings).toStrictEqual([]);
    });
  });

  describe('GIVEN overwrite mode', () => {
    it('WHEN building warnings THEN it says existing content is replaced', () => {
      const input = createSetupPlanInput({ mode: 'overwrite' });
      const warnings = buildPlanWarnings(createPlanWarningsInput({ input }));

      expect(warnings).toStrictEqual(['Overwrite mode replaces existing config content.']);
    });

    it('WHEN the serializer rewrote the config THEN there is no rewrite warning', () => {
      const input = createSetupPlanInput({ mode: 'overwrite' });
      const mergedConfig = createClientConfigMergeResult({ rewritten: true, rewriteCause: 'new-entry' });
      const warnings = buildPlanWarnings(createPlanWarningsInput({ input, mergedConfig }));

      expect(warnings).toStrictEqual(['Overwrite mode replaces existing config content.']);
    });
  });

  describe('GIVEN an overwrite of the Claude Code state file', () => {
    it('WHEN building warnings THEN it says the file was left unchanged and points to merge mode', () => {
      const warnings = buildPlanWarnings(createPlanWarningsInput({ isClaudeStateOverwrite: true }));

      expect(warnings).toStrictEqual([
        `Overwrite would replace Claude Code's whole state file at ${DEFAULT_CLAUDE_PATH} (account, projects, other servers); it was left unchanged. Run again and use --mode merge.`,
      ]);
    });
  });

  describe('GIVEN an existing config setup will not merge into', () => {
    it('WHEN it is unmergeable THEN the warning carries the reason alone', () => {
      const warnings = buildInvalidMergeWarnings('unmergeable');

      expect(warnings).toStrictEqual([`Existing config at ${DEFAULT_CLAUDE_PATH} was left unchanged: bad shape.`]);
    });

    it('WHEN it is invalid JSON THEN the warning says so and asks for a manual edit', () => {
      const warnings = buildInvalidMergeWarnings('invalid-json');

      expect(warnings).toStrictEqual([
        `Existing config at ${DEFAULT_CLAUDE_PATH} is not valid JSON and was left unchanged (bad shape). Add the agentic-mcp entry by hand.`,
      ]);
    });

    it('WHEN it is invalid TOML THEN the warning says it could not be merged safely', () => {
      const warnings = buildInvalidMergeWarnings('invalid-toml');

      expect(warnings).toStrictEqual([
        `Existing config at ${DEFAULT_CLAUDE_PATH} could not be merged safely and was left unchanged (bad shape). Add the agentic-mcp entry by hand.`,
      ]);
    });
  });

  describe('GIVEN a merge that rewrites a codex TOML config', () => {
    it('WHEN a new entry is added THEN the warning explains why the table could not be appended', () => {
      const warnings = buildCodexRewriteWarnings('new-entry');

      expect(warnings).toStrictEqual([
        `Adding the agentic-mcp entry rewrites ${CODEX_CONFIG_PATH_STUB} with a TOML serializer, because a new [mcp_servers.agentic-mcp] table cannot be appended to it (for example, mcp_servers is an inline table), ${KEPT_NOTE}`,
      ]);
    });

    it('WHEN the existing entry is updated THEN the warning names the update', () => {
      const warnings = buildCodexRewriteWarnings('existing-entry');

      expect(warnings).toStrictEqual([
        `Updating the existing agentic-mcp entry rewrites ${CODEX_CONFIG_PATH_STUB} with a TOML serializer, ${KEPT_NOTE}`,
      ]);
    });
  });

  describe('GIVEN CODEX_HOME points elsewhere', () => {
    it('WHEN building warnings THEN it appends the moved-config warning', () => {
      const env = Object.fromEntries([['CODEX_HOME', '/srv/codex']]);
      const input = createSetupPlanInput({ client: 'codex', env });
      const warnings = buildPlanWarnings(createPlanWarningsInput({ input, targetPath: CODEX_CONFIG_PATH_STUB }));

      expect(warnings).toStrictEqual([
        `CODEX_HOME is set, so codex may read /srv/codex/config.toml instead of ${CODEX_CONFIG_PATH_STUB}, which setup writes. If it does, run setup again with --path /srv/codex/config.toml.`,
      ]);
    });
  });
});
