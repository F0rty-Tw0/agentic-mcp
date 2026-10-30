// TypeScript 7 ships no compiler JS API, so every package that peers on `typescript`
// (typescript-eslint, lint-suite rules, import resolvers) gets TypeScript 6 as a private
// dependency. The root `typescript` (TypeScript 7) only provides `tsc`.
// Drop this file once those tools support the TypeScript 7 API.
const TYPESCRIPT_6 = 'npm:typescript@^6.0.3';

const readPackage = (pkg) => {
  const peersOnTypeScript = pkg.peerDependencies?.typescript !== undefined;

  if (!peersOnTypeScript) return pkg;

  delete pkg.peerDependencies.typescript;
  pkg.dependencies = { ...pkg.dependencies, typescript: TYPESCRIPT_6 };

  return pkg;
};

module.exports = { hooks: { readPackage } };
