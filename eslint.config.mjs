import { base, javascript, typescript, json, prettier } from 'lint-suite';

export default [
  ...base,
  ...javascript,
  ...json,
  ...typescript,
  ...prettier,
  { ignores: ['dist', 'node_modules'] },
];
