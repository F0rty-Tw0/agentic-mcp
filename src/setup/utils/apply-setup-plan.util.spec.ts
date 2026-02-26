import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { applySetupPlan } from './apply-setup-plan.util';
import type { SetupFs, SetupPlan } from '../common';

const VALID_WRITTEN_CONFIG = '{"mcpServers":{"agentic-mcp":{"command":"npx","args":["-y","agentic-mcp"]}}}';

const createPlan = (overrides: Partial<SetupPlan> = {}): SetupPlan => {
  const plan: SetupPlan = {
    client: 'claude-code',
    mode: 'merge',
    backup: 'if-exists',
    dryRun: false,
    writeIntent: 'write',
    targetPath: path.join('/home/dev', '.claude/claude_desktop_config.json'),
    mergeStatusPreview: 'merged',
    configText: '{"mcpServers":{"agentic-mcp":{"command":"npx","args":["-y","agentic-mcp"]}}}\n',
    warnings: [],
    ...overrides,
  };

  return plan;
};

const createFsMocks = (): SetupFs => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
  rename: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  copyFile: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ isFile: () => true }),
});

describe('applySetupPlan', () => {
  it('GIVEN existing target and backup policy if-exists WHEN applying THEN creates backup', async () => {
    const fs = createFsMocks();

    vi.spyOn(fs, 'readFile').mockResolvedValueOnce(VALID_WRITTEN_CONFIG);

    const plan = createPlan();
    const result = await applySetupPlan(plan, fs);

    expect(fs.copyFile).toHaveBeenCalledWith(plan.targetPath, `${plan.targetPath}.bak`, expect.any(Number));
    expect(result.backupPath).toBe(`${plan.targetPath}.bak`);
    expect(result.status).toBe('written');
  });

  it('GIVEN write intent write WHEN applying THEN writes temp file and renames atomically', async () => {
    const fs = createFsMocks();

    vi.spyOn(fs, 'readFile').mockResolvedValueOnce(VALID_WRITTEN_CONFIG);

    const plan = createPlan();

    await applySetupPlan(plan, fs);

    expect(fs.writeFile).toHaveBeenCalledWith(`${plan.targetPath}.tmp`, plan.configText, 'utf8');
    expect(fs.rename).toHaveBeenCalledWith(`${plan.targetPath}.tmp`, plan.targetPath);
  });

  it('GIVEN write operation WHEN applying THEN verifies written config by read-back', async () => {
    const fs = createFsMocks();

    vi.spyOn(fs, 'readFile').mockResolvedValueOnce(VALID_WRITTEN_CONFIG);

    const result = await applySetupPlan(createPlan(), fs);

    expect(result.status).toBe('written');
    expect(result.reason).toBeUndefined();
  });

  it('GIVEN dry-run plan WHEN applying THEN skips writes', async () => {
    const fs = createFsMocks();
    const plan = createPlan({
      dryRun: true,
      writeIntent: 'skip',
    });

    const result = await applySetupPlan(plan, fs);

    expect(result.status).toBe('skipped');
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(fs.rename).not.toHaveBeenCalled();
  });

  it('GIVEN invalid read-back JSON WHEN applying THEN returns verification-failed', async () => {
    const fs = createFsMocks();

    vi.spyOn(fs, 'readFile').mockResolvedValueOnce('{ bad json');

    const result = await applySetupPlan(createPlan(), fs);

    expect(result.status).toBe('verification-failed');
    expect(result.reason).toContain('Invalid JSON');
  });

  it('GIVEN write intent manual WHEN applying THEN returns manual and skips writes', async () => {
    const fs = createFsMocks();
    const plan = createPlan({
      writeIntent: 'manual',
    });

    const result = await applySetupPlan(plan, fs);

    expect(result.status).toBe('manual');
    expect(result.path).toBe(plan.targetPath);
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(fs.rename).not.toHaveBeenCalled();
  });

  it('GIVEN missing target path WHEN applying THEN returns manual', async () => {
    const fs = createFsMocks();
    const plan = createPlan({
      targetPath: undefined,
    });

    const result = await applySetupPlan(plan, fs);

    expect(result.status).toBe('manual');
    expect(result.path).toBeUndefined();
    expect(fs.mkdir).not.toHaveBeenCalled();
  });

  it('GIVEN backup policy never WHEN applying THEN skips backup copy', async () => {
    const fs = createFsMocks();
    const plan = createPlan({
      backup: 'never',
    });

    vi.spyOn(fs, 'readFile').mockResolvedValueOnce(VALID_WRITTEN_CONFIG);

    const result = await applySetupPlan(plan, fs);

    expect(result.status).toBe('written');
    expect(result.backupPath).toBeUndefined();
    expect(fs.copyFile).not.toHaveBeenCalled();
  });

  it('GIVEN backup policy if-exists and missing target WHEN applying THEN skips backup copy', async () => {
    const fs = createFsMocks();
    const plan = createPlan();

    vi.spyOn(fs, 'stat').mockRejectedValueOnce(new Error('ENOENT'));
    vi.spyOn(fs, 'readFile').mockResolvedValueOnce(VALID_WRITTEN_CONFIG);

    const result = await applySetupPlan(plan, fs);

    expect(result.status).toBe('written');
    expect(result.backupPath).toBeUndefined();
    expect(fs.copyFile).not.toHaveBeenCalled();
  });

  it('GIVEN non-object JSON root in read-back WHEN applying THEN returns verification-failed reason', async () => {
    const fs = createFsMocks();

    vi.spyOn(fs, 'readFile').mockResolvedValueOnce('[]');

    const result = await applySetupPlan(createPlan(), fs);

    expect(result.status).toBe('verification-failed');
    expect(result.reason).toBe('Written config root must be an object.');
  });

  it('GIVEN missing mcpServers object in read-back WHEN applying THEN returns verification-failed reason', async () => {
    const fs = createFsMocks();

    vi.spyOn(fs, 'readFile').mockResolvedValueOnce('{}');

    const result = await applySetupPlan(createPlan(), fs);

    expect(result.status).toBe('verification-failed');
    expect(result.reason).toBe('Written config must include object key mcpServers.');
  });

  it('GIVEN missing agentic-mcp entry in read-back WHEN applying THEN returns verification-failed reason', async () => {
    const fs = createFsMocks();

    vi.spyOn(fs, 'readFile').mockResolvedValueOnce('{"mcpServers":{}}');

    const result = await applySetupPlan(createPlan(), fs);

    expect(result.status).toBe('verification-failed');
    expect(result.reason).toBe('Written config must include mcpServers["agentic-mcp"].');
  });
});
