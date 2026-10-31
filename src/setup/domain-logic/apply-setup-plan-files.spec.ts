import { chmod, lstat, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applySetupPlan } from './apply-setup-plan';
import type { SetupPlan } from '../common';

const CONFIG_TEXT = '{"mcpServers":{"agentic-mcp":{"command":"npx","args":["-y","agentic-mcp"]}}}\n';
const PERMISSION_BITS = 0o777;
const OWNER_ONLY_MODE = 0o600;

const createPlan = (targetPath: string): SetupPlan => {
  const plan: SetupPlan = {
    client: 'claude-code',
    mode: 'merge',
    backup: 'if-exists',
    dryRun: false,
    writeIntent: 'write',
    targetPath,
    mergeStatusPreview: 'merged',
    configText: CONFIG_TEXT,
    warnings: [],
    notes: [],
  };

  return plan;
};

const readMode = async (targetPath: string): Promise<number> => {
  const fileStat = await stat(targetPath);
  const mode = fileStat.mode & PERMISSION_BITS;

  return mode;
};

describe('applySetupPlan on a real filesystem', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'agentic-setup-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('GIVEN an owner-only config WHEN setup writes it THEN the file stays owner-only', async () => {
    const targetPath = path.join(directory, '.claude.json');

    await writeFile(targetPath, '{"oauthAccount":{}}\n', 'utf8');
    await chmod(targetPath, OWNER_ONLY_MODE);

    await applySetupPlan(createPlan(targetPath));

    const mode = await readMode(targetPath);

    expect(mode).toBe(OWNER_ONLY_MODE);
  });

  it('GIVEN no existing config WHEN setup creates it THEN the new file is owner-only', async () => {
    const targetPath = path.join(directory, 'nested', 'mcp.json');

    await applySetupPlan(createPlan(targetPath));

    const mode = await readMode(targetPath);

    expect(mode).toBe(OWNER_ONLY_MODE);
  });

  it('GIVEN the config is a symlink WHEN setup writes it THEN the link stays and its target is updated', async () => {
    const realPath = path.join(directory, 'real.json');
    const linkPath = path.join(directory, 'link.json');

    await writeFile(realPath, '{}\n', 'utf8');
    await symlink(realPath, linkPath);

    await applySetupPlan(createPlan(linkPath));

    const linkStat = await lstat(linkPath);
    const realContent = await readFile(realPath, 'utf8');

    expect(linkStat.isSymbolicLink()).toBe(true);
    expect(realContent).toBe(CONFIG_TEXT);
  });

  it('GIVEN a backup from an earlier run WHEN setup runs again THEN the earlier backup is kept', async () => {
    const targetPath = path.join(directory, 'mcp.json');
    const backupPath = `${targetPath}.bak`;

    await writeFile(targetPath, '{"first":true}\n', 'utf8');
    await writeFile(backupPath, '{"original":true}\n', 'utf8');

    const result = await applySetupPlan(createPlan(targetPath));
    const firstBackup = await readFile(backupPath, 'utf8');
    const entries = await readdir(directory);
    const backups = entries.filter((entry) => entry.endsWith('.bak'));

    expect(firstBackup).toBe('{"original":true}\n');
    expect(backups).toHaveLength(2);
    expect(result.backupPath).not.toBe(backupPath);
  });

  it('GIVEN a stale world-readable temp file WHEN setup writes an owner-only config THEN the result stays owner-only', async () => {
    const targetPath = path.join(directory, '.claude.json');

    await writeFile(targetPath, '{}\n', 'utf8');
    await chmod(targetPath, OWNER_ONLY_MODE);
    await writeFile(`${targetPath}.tmp`, 'stale', 'utf8');
    await chmod(`${targetPath}.tmp`, 0o644);

    await applySetupPlan(createPlan(targetPath));

    const mode = await readMode(targetPath);

    expect(mode).toBe(OWNER_ONLY_MODE);
  });

  it('GIVEN an opencode plan WHEN setup writes it THEN the agentic-mcp entry under mcp passes verification', async () => {
    const targetPath = path.join(directory, 'opencode.json');
    const configText = '{"mcp":{"agentic-mcp":{"type":"local","command":["npx","-y","agentic-mcp"]}}}\n';
    const basePlan = createPlan(targetPath);
    const plan: SetupPlan = { ...basePlan, client: 'opencode', configText };

    const result = await applySetupPlan(plan);

    expect(result.status).toBe('written');
  });

  it('GIVEN a codex plan WHEN setup writes the TOML file THEN it passes verification', async () => {
    const targetPath = path.join(directory, 'config.toml');
    const configText = '[mcp_servers.agentic-mcp]\ncommand = "npx"\ntool_timeout_sec = 4260\n';
    const basePlan = createPlan(targetPath);
    const plan: SetupPlan = { ...basePlan, client: 'codex', configText };

    const result = await applySetupPlan(plan);
    const written = await readFile(targetPath, 'utf8');

    expect(result.status).toBe('written');
    expect(written).toBe(configText);
  });

  it('GIVEN a codex plan without the agentic-mcp table WHEN setup writes it THEN verification fails', async () => {
    const targetPath = path.join(directory, 'config.toml');
    const basePlan = createPlan(targetPath);
    const plan: SetupPlan = { ...basePlan, client: 'codex', configText: 'model = "gpt-6"\n' };

    const result = await applySetupPlan(plan);

    expect(result.status).toBe('verification-failed');
    expect(result.reason).toBe('Written config must include object key mcp_servers.');
  });

  it('GIVEN a codex plan whose text is not TOML WHEN setup writes it THEN verification fails with the parser message', async () => {
    const targetPath = path.join(directory, 'config.toml');
    const basePlan = createPlan(targetPath);
    const plan: SetupPlan = { ...basePlan, client: 'codex', configText: '[mcp_servers\n' };

    const result = await applySetupPlan(plan);

    expect(result.reason).toMatch(/^Invalid TOML in written file: /);
  });

  it('GIVEN an unchanged plan WHEN setup applies it THEN the file keeps its inode and no backup is made', async () => {
    const targetPath = path.join(directory, '.claude.json');

    await writeFile(targetPath, CONFIG_TEXT, 'utf8');

    const before = await stat(targetPath);
    const basePlan = createPlan(targetPath);
    const plan: SetupPlan = { ...basePlan, writeIntent: 'unchanged', backup: 'always' };

    await applySetupPlan(plan);

    const after = await stat(targetPath);
    const entries = await readdir(directory);

    expect([after.ino, after.mtimeMs]).toStrictEqual([before.ino, before.mtimeMs]);
    expect(entries).toStrictEqual(['.claude.json']);
  });

  it('GIVEN an unchanged plan WHEN setup applies it THEN the result says it is already configured', async () => {
    const targetPath = path.join(directory, '.claude.json');
    const basePlan = createPlan(targetPath);
    const plan: SetupPlan = { ...basePlan, writeIntent: 'unchanged' };

    const result = await applySetupPlan(plan);

    expect(result).toStrictEqual({
      status: 'unchanged',
      path: targetPath,
      backupPath: undefined,
      reason: 'already configured; the agentic-mcp entry is up to date, so no file or backup was written',
    });
  });
});
