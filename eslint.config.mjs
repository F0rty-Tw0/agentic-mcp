import { base, javascript, json, prettier, typescript, vitest } from 'lint-suite';

export default [
  ...base,
  ...javascript,
  ...json,
  ...vitest,
  ...typescript,
  ...prettier,
  {
    ignores: ['dist', 'node_modules', '.omc', '.claude', './*.config.*', '!./src/**/*.config.*'],
  },
];
