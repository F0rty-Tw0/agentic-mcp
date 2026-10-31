export type TomlRecord = Readonly<Record<string, unknown>>;

export type ParsedTomlSuccess = {
  readonly table: TomlRecord;
};

export type ParsedTomlFailure = {
  readonly reason: string;
};

export type ParsedTomlResult = ParsedTomlSuccess | ParsedTomlFailure;
