import type { DetectedProvider, ParsedSetupArgs, SetupCliDependencies } from './setup.type';

export type SetupCliFlowInput = {
  readonly parsedArgs: ParsedSetupArgs;
  readonly dependencies: SetupCliDependencies;
  readonly detectedProviders: DetectedProvider[];
};
