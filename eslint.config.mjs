import { base, boundaries, javascript, json, prettier, typescript, vitest } from 'lint-suite/eslint';

export default [
  ...base,
  ...javascript,
  ...json,
  ...vitest,
  ...typescript,
  ...boundaries,
  ...prettier,
  {
    // SDK 1.29+ maps the ./* export's types condition to *.d.ts, so 'sdk/server/mcp.js' looks for mcp.js.d.ts;
    // tsc falls back to the sibling .d.ts, the import resolver does not.
    files: ['**/*.ts'],
    rules: { 'import-x/no-unresolved': ['error', { ignore: ['^@modelcontextprotocol/sdk/'] }] },
  },
  {
    ignores: ['dist', 'node_modules', 'coverage', '.omc', '.claude', './*.config.*', '!./src/**/*.config.*'],
  },
];
