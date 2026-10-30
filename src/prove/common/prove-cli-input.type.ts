import type { ProveCliDependencies } from './prove-cli-dependencies.type';

export type ProveCliInput = {
  readonly args: string[];
  readonly configPath?: string;
  readonly dependencies?: ProveCliDependencies;
};
