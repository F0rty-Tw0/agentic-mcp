import { base, boundaries, javascript, json, prettier, typescript, vitest } from 'lint-suite';

export default [
  ...base,
  ...javascript,
  ...json,
  ...vitest,
  ...typescript,
  ...boundaries,
  ...prettier,
  {
    ignores: ['dist', 'node_modules', 'coverage', '.omc', '.claude', './*.config.*', '!./src/**/*.config.*'],
  },
];
