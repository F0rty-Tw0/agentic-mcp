import { cpSync, rmSync } from 'node:fs';

import * as esbuild from 'esbuild';

rmSync('dist', { recursive: true, force: true });

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/index.js',
  target: 'node22',
  packages: 'external',
});

cpSync('src/config/providers.json', 'dist/providers.json');
