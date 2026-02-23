export const parseConfigPath = (argv: readonly string[]): string | undefined => {
  const configIndex = argv.indexOf('--config');

  return configIndex !== -1 && configIndex + 1 < argv.length ? argv[configIndex + 1] : undefined;
};
