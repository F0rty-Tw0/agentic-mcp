import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline';

import { CLIENT_CONFIG_PATHS, SUPPORTED_CLIENTS } from './common/index.ts';
import type { SupportedClient } from './common/index.ts';
import { detectInstalledProviders } from './domain-logic/detect-providers.ts';
import { generateClientConfig } from './domain-logic/generate-config.ts';

const DEFAULT_CLIENT: SupportedClient = 'generic';

const parseArgs = (args: readonly string[]): { client: SupportedClient; dryRun: boolean } => {
  let client: SupportedClient = DEFAULT_CLIENT;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--client' && i + 1 < args.length) {
      const value = args[i + 1] as string;

      if ((SUPPORTED_CLIENTS as readonly string[]).includes(value)) {
        client = value as SupportedClient;
      } else {
        process.stderr.write(`Warning: unknown client "${value}", using "generic"\n`);
      }

      i++;
    }
  }

  return { client, dryRun };
};

const promptConfirm = async (question: string): Promise<boolean> => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  return new Promise<boolean>((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
};

const printProviderSummary = (detectedProviders: Awaited<ReturnType<typeof detectInstalledProviders>>): void => {
  process.stdout.write('\nDetected providers:\n');

  for (const provider of detectedProviders) {
    const status = provider.available ? `✓ ${provider.binaryPath}` : '✗ not found';

    process.stdout.write(`  ${provider.name}: ${status}\n`);
  }
};

export const runSetup = async (args: readonly string[]): Promise<void> => {
  const { client, dryRun } = parseArgs(args);

  process.stdout.write(`agentic-mcp setup\n`);
  process.stdout.write(`Client: ${client}\n`);

  if (dryRun) {
    process.stdout.write('Mode: dry-run (no files will be written)\n');
  }

  process.stdout.write('\nDetecting installed providers...\n');
  const detectedProviders = await detectInstalledProviders();

  printProviderSummary(detectedProviders);

  const configJson = generateClientConfig(client, detectedProviders);
  const relativeConfigPath = CLIENT_CONFIG_PATHS[client];
  const configPath = relativeConfigPath !== null ? path.join(homedir(), relativeConfigPath) : null;

  process.stdout.write('\nGenerated config:\n');
  process.stdout.write(`${configJson}\n`);

  if (configPath === null) {
    process.stdout.write('\nNo config file path for "generic" client. Copy the config above manually.\n');

    return;
  }

  if (dryRun) {
    process.stdout.write(`\n[dry-run] Would write config to: ${configPath}\n`);

    return;
  }

  const confirmed = await promptConfirm(`\nWrite config to ${configPath}? [y/N] `);

  if (!confirmed) {
    process.stdout.write('Aborted. No files written.\n');

    return;
  }

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${configJson}\n`, 'utf8');

  process.stdout.write(`\nConfig written to: ${configPath}\n`);
  process.stdout.write('Setup complete.\n');
};
