import type { DetectedProvider } from '../../common';

type JsonNextStep = {
  readonly command: string;
  readonly kind: string;
  readonly purpose: string;
};

type JsonSummary = {
  readonly completedSteps: string[];
  readonly unproven: string[];
  readonly nextStep: JsonNextStep;
  readonly firstProofCommand?: string;
};

type JsonApplyResult = {
  readonly status: string;
  readonly path?: string;
  readonly backupPath?: string;
};

type JsonSkillResult = {
  readonly status: string;
  readonly skillPath: string;
  readonly reason?: string;
};

export type ConfiguredJsonOutput = {
  readonly backup: string;
  readonly client: string;
  readonly dryRun: boolean;
  readonly mergeStatusPreview: string;
  readonly mode: string;
  readonly notes: string[];
  readonly providers: DetectedProvider[];
  readonly result: JsonApplyResult;
  readonly skillResult?: JsonSkillResult;
  readonly summary: JsonSummary;
  readonly targetPath?: string;
  readonly warnings: string[];
  readonly writeIntent: string;
};

export type MinimalJsonOutput = {
  readonly client: string;
  readonly mode: string;
  readonly nextSteps: string[];
  readonly providers: DetectedProvider[];
  readonly skillResult: JsonSkillResult;
  readonly summary: JsonSummary;
};
