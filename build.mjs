import { cpSync, readFileSync, rmSync } from 'node:fs';

import * as esbuild from 'esbuild';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

rmSync('dist', { recursive: true, force: true });

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/index.js',
  target: 'node22',
  packages: 'external',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});

cpSync('src/config/providers.json', 'dist/providers.json');
