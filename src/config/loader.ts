import { access, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import type { ConfigPathOptions, ProvidersFile } from '../shared/common/index.ts';
import { providersFileSchema } from '../shared/common/index.ts';

const DANGEROUS_FLAGS = [
  '--dangerously-skip-permissions',
  '--allow-all-tools',
  '--allow-all',
  '--trust-all-tools',
  '--full-auto',
  '--yes-always',
  '--yolo',
] as const;

type DangerousFlag = (typeof DANGEROUS_FLAGS)[number];

const userLocalConfigPath = (): string | null => {
  if (process.platform !== 'win32') return path.join(os.homedir(), '.config', 'agentic-mcp', 'providers.json');

  const appData = process.env.APPDATA;

  return appData ? path.join(appData, 'agentic-mcp', 'providers.json') : null;
};

const resolveConfigPath = async (explicit?: string): Promise<string> => {
  // 1. Explicit --config flag
  if (explicit) return path.resolve(explicit);

  // 2. Environment variable
  const envPath = process.env.AGENTIC_MCP_CONFIG;

  if (envPath) return path.resolve(envPath);

  // 3. User-local config (first-found-wins, skip if absent)
  const userLocal = userLocalConfigPath();

  if (userLocal) {
    try {
      await access(userLocal);

      return userLocal;
    } catch {
      // Fall through to bundled default
    }
  }

  // 4. Bundled default alongside this module
  return fileURLToPath(new URL('./providers.json', import.meta.url));
};

const warnDangerousFlags = (config: ProvidersFile): void => {
  for (const [name, provider] of Object.entries(config.providers)) {
    const askCommand = provider.commands.ask;

    if (!askCommand) continue;
    const autoMode = askCommand.flags?.autoMode;

    if (!Array.isArray(autoMode)) continue;

    for (const flag of autoMode) {
      if (DANGEROUS_FLAGS.includes(flag as DangerousFlag)) {
        process.stderr.write(`Warning: provider "${name}" uses dangerous auto-mode flag "${flag}"\n`);
      }
    }
  }
};

export const loadConfig = async (options?: ConfigPathOptions): Promise<ProvidersFile> => {
  const configPath = await resolveConfigPath(options?.configPath);
  const raw = await readFile(configPath, 'utf-8');
  const json: unknown = JSON.parse(raw);
  const config = providersFileSchema.parse(json);

  warnDangerousFlags(config);

  return config;
};
