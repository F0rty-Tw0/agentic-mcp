import { base, javascript, json, prettier, typescript } from 'lint-suite';

export default [
  ...base,
  ...javascript,
  ...json,
  ...typescript,
  ...prettier,
  { ignores: ['dist', 'node_modules'] },
];
