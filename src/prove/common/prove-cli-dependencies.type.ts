import type { DetectedProvider } from '../../setup/common';

export type ProveCliDependencies = {
  // eslint-disable-next-line local/readonly-type-properties -- setup's detectInstalledProviders resolves a readonly array
  readonly detectInstalledProviders: () => Promise<readonly DetectedProvider[]>;
  readonly runCli: (subcommand: string, remainingArgs: string[], configPath?: string) => Promise<void>;
  readonly stdoutWrite: (text: string) => void;
  readonly stderrWrite: (text: string) => void;
};
