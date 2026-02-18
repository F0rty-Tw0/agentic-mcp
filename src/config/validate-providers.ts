import fs from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { providersFileSchema } from '../common/provider-config.schema.ts';

const providersUrl = new URL('./providers.json', import.meta.url);
const providersPath = fileURLToPath(providersUrl);

const formatIssuePath = (pathSegments: PropertyKey[]): string => {
  if (pathSegments.length === 0) {
    return '(root)';
  }

  return pathSegments
    .map((segment) => {
      if (typeof segment === 'number') {
        return `[${segment}]`;
      }

      if (typeof segment === 'symbol') {
        return String(segment);
      }

      return segment;
    })
    .join('.');
};

const main = async (): Promise<void> => {
  let rawJson: string;

  try {
    rawJson = await fs.readFile(providersPath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read providers config at "${providersPath}".`, { cause: error });
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(rawJson) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON in "${providersPath}".`, { cause: error });
  }

  const result = providersFileSchema.safeParse(parsedJson);

  if (!result.success) {
    process.stderr.write(`Provider config validation failed: ${providersPath}\n`);

    for (const issue of result.error.issues) {
      const issuePath = formatIssuePath(issue.path);

      process.stderr.write(`- ${issuePath}: ${issue.message}\n`);
    }
    process.exitCode = 1;

    return;
  }

  process.stdout.write(`Provider config is valid: ${providersPath}\n`);
};

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Unknown error while validating providers config.';

  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
