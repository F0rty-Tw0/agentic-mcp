import type { DetectedProvider } from '../../setup/common';

export type ProveCliDependencies = Readonly<{
  detectInstalledProviders: () => Promise<readonly DetectedProvider[]>;
  runCli: (subcommand: string, remainingArgs: readonly string[], configPath?: string) => Promise<void>;
  stdoutWrite: (text: string) => void;
  stderrWrite: (text: string) => void;
}>;
