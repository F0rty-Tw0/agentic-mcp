import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import { SKILL_CONTENT } from '../common/skill-content';

export type SkillInstallResult = Readonly<{
  status: 'installed' | 'already-exists' | 'error';
  skillPath: string;
  reason?: string;
}>;

export type SkillInstallDependencies = Readonly<{
  homeDirectory: string;
  mkdir: (path: string, options: { recursive: boolean }) => Promise<void>;
  writeFile: (path: string, content: string, encoding: 'utf8') => Promise<void>;
  readFile: (path: string, encoding: 'utf8') => Promise<string>;
}>;

const defaultDependencies: SkillInstallDependencies = {
  homeDirectory: homedir(),
  mkdir: async (dirPath, options) => {
    await mkdir(dirPath, options);
  },
  writeFile: async (filePath, content, encoding) => writeFile(filePath, content, encoding),
  readFile: async (filePath, encoding) => readFile(filePath, encoding),
};

export const installSkill = async (
  injectedDependencies?: Partial<SkillInstallDependencies>
): Promise<SkillInstallResult> => {
  const dependencies: SkillInstallDependencies = { ...defaultDependencies, ...injectedDependencies };
  const skillPath = path.join(dependencies.homeDirectory, '.claude', 'skills', 'using-agentic-mcp', 'SKILL.md');

  try {
    const existing = await dependencies.readFile(skillPath, 'utf8');

    if (existing === SKILL_CONTENT) {
      const result: SkillInstallResult = { status: 'already-exists', skillPath };

      return result;
    }
  } catch {
    // File does not exist or is unreadable — proceed to install
  }

  try {
    await dependencies.mkdir(path.dirname(skillPath), { recursive: true });
    await dependencies.writeFile(skillPath, SKILL_CONTENT, 'utf8');

    const result: SkillInstallResult = { status: 'installed', skillPath };

    return result;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const result: SkillInstallResult = { status: 'error', skillPath, reason };

    return result;
  }
};
