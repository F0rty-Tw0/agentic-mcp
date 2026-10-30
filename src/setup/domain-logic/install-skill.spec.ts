import path from 'node:path';

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SetupMkdirOptions, SkillInstallDependencies, SkillInstallResult } from '../common';
import { SKILL_CONTENT } from '../common/skill-content';

const mocks = vi.hoisted(() => {
  const homedir = vi.fn<() => string>();
  const mkdir = vi.fn<(path: string, options: SetupMkdirOptions) => Promise<void>>();
  const readFile = vi.fn<(path: string, encoding: 'utf8') => Promise<string>>();
  const writeFile = vi.fn<(path: string, content: string, encoding: 'utf8') => Promise<void>>();
  const missingFileError = new Error('ENOENT');

  homedir.mockReturnValue('/home/default');
  mkdir.mockResolvedValue(undefined);
  readFile.mockRejectedValue(missingFileError);
  writeFile.mockResolvedValue(undefined);

  const hoistedMocks = { homedir, mkdir, readFile, writeFile };

  return hoistedMocks;
});

vi.mock('node:os', () => {
  const osModule = { homedir: mocks.homedir };

  return osModule;
});

vi.mock('node:fs/promises', () => {
  const fsModule = {
    mkdir: mocks.mkdir,
    readFile: mocks.readFile,
    writeFile: mocks.writeFile,
  };

  return fsModule;
});

let installSkill: (injectedDependencies?: Partial<SkillInstallDependencies>) => Promise<SkillInstallResult>;

const createDeps = (overrides?: Record<string, unknown>): Record<string, unknown> => {
  const missingFileError = new Error('ENOENT');
  const readFile = vi.fn<(path: string) => Promise<string>>().mockRejectedValue(missingFileError);
  const writeFile = vi.fn<(path: string, content: string) => Promise<void>>().mockResolvedValue(undefined);
  const mkdir = vi.fn<(path: string, opts: unknown) => Promise<void>>().mockResolvedValue(undefined);
  const defaults = {
    readFile,
    writeFile,
    mkdir,
    homeDirectory: '/home/dev',
  };
  const deps = { ...defaults, ...overrides };

  return deps;
};

describe('installSkill', () => {
  beforeAll(async () => {
    const installSkillModule = await import('./install-skill');

    installSkill = installSkillModule.installSkill;
  });

  beforeEach(() => {
    mocks.homedir.mockReset();
    mocks.mkdir.mockReset();
    mocks.readFile.mockReset();
    mocks.writeFile.mockReset();

    mocks.homedir.mockReturnValue('/home/default');
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.readFile.mockRejectedValue(new Error('ENOENT'));
    mocks.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('injected-dependency path', () => {
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

      const readFile = vi.fn().mockResolvedValue(SKILL_CONTENT);
      const result = await installSkill(createDeps({ readFile, writeFile }));

      expect(writeFile).not.toHaveBeenCalled();
      expect(result.status).toBe('already-exists');
    });

    it('GIVEN skill content differs from existing file WHEN installing skill THEN overwrites with new content', async () => {
      const writeFile = vi.fn().mockResolvedValue(undefined);

      const readFile = vi.fn().mockResolvedValue('outdated content');
      const result = await installSkill(createDeps({ readFile, writeFile }));

      expect(writeFile).toHaveBeenCalledWith(expect.any(String), SKILL_CONTENT, 'utf8');
      expect(result.status).toBe('installed');
    });

    it('GIVEN writeFile throws an Error WHEN installing skill THEN returns error status with message as reason', async () => {
      const permissionError = new Error('EACCES: permission denied');
      const writeFile = vi.fn().mockRejectedValue(permissionError);
      const result = await installSkill(createDeps({ writeFile }));

      expect(result.status).toBe('error');
      expect(result.reason).toBe('EACCES: permission denied');
    });

    it('GIVEN writeFile throws a non-Error value WHEN installing skill THEN returns error status with stringified reason', async () => {
      const writeFile = vi.fn().mockRejectedValue('disk full');
      const result = await installSkill(createDeps({ writeFile }));

      expect(result.status).toBe('error');
      expect(result.reason).toBe('disk full');
    });

    it('GIVEN home directory WHEN installing skill THEN skill path ends with expected cross-platform suffix', async () => {
      const result = await installSkill(createDeps());

      expect(result.skillPath).toMatch(/\.claude[/\\]skills[/\\]using-agentic-mcp[/\\]SKILL\.md$/);
    });
  });

  describe('default-dependency path (exercises node module wrappers)', () => {
    it('GIVEN no injected deps and node fs modules mocked WHEN file does not exist THEN installs via default wrappers', async () => {
      const result = await installSkill();

      expect(mocks.mkdir).toHaveBeenCalledTimes(1);
      expect(mocks.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
      expect(mocks.writeFile).toHaveBeenCalledTimes(1);
      expect(mocks.writeFile).toHaveBeenCalledWith(expect.any(String), SKILL_CONTENT, 'utf8');
      expect(result.status).toBe('installed');
    });

    it('GIVEN no injected deps and file matches current content WHEN installing THEN returns already-exists via default readFile', async () => {
      mocks.readFile.mockResolvedValue(SKILL_CONTENT);

      const result = await installSkill();

      expect(mocks.writeFile).not.toHaveBeenCalled();
      expect(result.status).toBe('already-exists');
    });

    it('GIVEN default homedir dependency WHEN installing skill THEN result path uses the captured home directory', async () => {
      const result = await installSkill();
      const expectedSkillPath = path.join('/home/default', '.claude', 'skills', 'using-agentic-mcp', 'SKILL.md');

      expect(result.skillPath).toBe(expectedSkillPath);
    });
  });
});
