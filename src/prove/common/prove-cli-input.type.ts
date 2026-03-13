import type { ProveCliDependencies } from './prove-cli-dependencies.type';

export type ProveCliInput = Readonly<{
  args: readonly string[];
  configPath?: string;
  dependencies?: ProveCliDependencies;
}>;
