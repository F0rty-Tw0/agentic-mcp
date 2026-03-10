import { describe, expect, it, vi } from 'vitest';

import { installSkill } from './install-skill';
import { SKILL_CONTENT } from '../common/skill-content';

const createDeps = (overrides?: Record<string, unknown>): Record<string, unknown> => {
  const defaults = {
    readFile: vi.fn<(path: string) => Promise<string>>().mockRejectedValue(new Error('ENOENT')),
    writeFile: vi.fn<(path: string, content: string) => Promise<void>>().mockResolvedValue(undefined),
    mkdir: vi.fn<(path: string, opts: unknown) => Promise<void>>().mockResolvedValue(undefined),
    homeDirectory: '/home/dev',
  };

  return { ...defaults, ...overrides };
};

describe('installSkill', () => {
  it('GIVEN directory does not exist WHEN installing skill THEN creates directory and writes file', async () => {
    const mkdir = vi.fn().mockResolvedValue(undefined);
    const writeFile = vi.fn().mockResolvedValue(undefined);

    const result = await installSkill(createDeps({ mkdir, writeFile }));

    expect(mkdir).toHaveBeenCalledTimes(1);
    expect(writeFile).toHaveBeenCalledWith(expect.any(String), SKILL_CONTENT, 'utf8');
    expect(result.status).toBe('installed');
  });

  it('GIVEN skill content matches existing file WHEN installing skill THEN returns already-exists without writing', async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);

    const result = await installSkill(
      createDeps({
        readFile: vi.fn().mockResolvedValue(SKILL_CONTENT),
        writeFile,
      })
    );

    expect(writeFile).not.toHaveBeenCalled();
    expect(result.status).toBe('already-exists');
  });

  it('GIVEN skill content differs from existing file WHEN installing skill THEN overwrites with new content', async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);

    const result = await installSkill(
      createDeps({
        readFile: vi.fn().mockResolvedValue('outdated content'),
        writeFile,
      })
    );

    expect(writeFile).toHaveBeenCalledWith(expect.any(String), SKILL_CONTENT, 'utf8');
    expect(result.status).toBe('installed');
  });

  it('GIVEN writeFile throws WHEN installing skill THEN returns error with reason', async () => {
    const result = await installSkill(
      createDeps({
        writeFile: vi.fn().mockRejectedValue(new Error('EACCES: permission denied')),
      })
    );

    expect(result.status).toBe('error');
    expect('reason' in result && result.reason).toBeTruthy();
  });

  it('GIVEN home directory WHEN installing skill THEN skill path ends with expected suffix', async () => {
    const result = await installSkill(createDeps());

    expect(result.skillPath).toMatch(/\.claude[/\\]skills[/\\]using-agentic-mcp[/\\]SKILL\.md$/);
  });
});
