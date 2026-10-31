import path from 'node:path';

import { CLIENT_TARGETS } from '../common';
import type { ConfigPathEnvRule, SetupEnv, SetupPlanInput } from '../common';

type MovedConfigPath = {
  readonly key: string;
  readonly clientPath: string;
};

const resolveMovedPath = (rule: ConfigPathEnvRule, env: SetupEnv): MovedConfigPath | undefined => {
  const value = env[rule.key];

  if (value == null || value === '') return undefined;

  const clientPath = path.resolve(value, rule.relativePath);
  const movedPath: MovedConfigPath = { key: rule.key, clientPath };

  return movedPath;
};

// A client reading its config elsewhere would never see the file setup writes.
export const buildMovedConfigWarnings = (input: SetupPlanInput, targetPath: string | undefined): string[] => {
  if (input.pathOverride != null || targetPath == null) return [];

  const env = input.env ?? {};
  const movedPaths = CLIENT_TARGETS[input.client].configPathEnvRules.map((rule) => resolveMovedPath(rule, env));
  const elsewherePaths = movedPaths.filter(
    (movedPath): movedPath is MovedConfigPath => movedPath != null && movedPath.clientPath !== targetPath
  );
  const warnings = elsewherePaths.map(
    ({ key, clientPath }) =>
      `${key} is set, so ${input.client} may read ${clientPath} instead of ${targetPath}, which setup writes. If it does, run setup again with --path ${clientPath}.`
  );

  return warnings;
};
