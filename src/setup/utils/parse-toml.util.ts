import { isDeepStrictEqual } from 'node:util';

import { parse } from 'smol-toml';

import type { ParsedTomlFailure, ParsedTomlResult, ParsedTomlSuccess, TomlRecord } from '../common';

const isRecord = (value: unknown): value is TomlRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

// smol-toml returns null-prototype tables; plain copies compare equal to the objects setup builds.
const toPlainValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(toPlainValue);

  if (!isRecord(value) || value instanceof Date) return value;

  const plainEntries = Object.entries(value).map(([key, item]): [string, unknown] => [key, toPlainValue(item)]);
  const plainRecord: TomlRecord = Object.fromEntries(plainEntries);

  return plainRecord;
};

// Large integers stay BigInt, so a rewrite keeps every digit.
const parseToml = (text: string): TomlRecord => {
  const parsedTable = parse(text, { integersAsBigInt: 'asNeeded' });
  const plainTable = toPlainValue(parsedTable);
  const emptyTable: TomlRecord = {};
  const table = isRecord(plainTable) ? plainTable : emptyTable;

  return table;
};

export const tryParseToml = (text: string): ParsedTomlResult => {
  try {
    const parsedResult: ParsedTomlSuccess = { table: parseToml(text) };

    return parsedResult;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invalid TOML';
    const [firstLine] = message.split('\n');
    const failureResult: ParsedTomlFailure = { reason: `Invalid TOML: ${String(firstLine)}` };

    return failureResult;
  }
};

export const parsesTo = (text: string, expectedRoot: TomlRecord): boolean => {
  const parsed = tryParseToml(text);
  const isMatch = 'table' in parsed && isDeepStrictEqual(parsed.table, expectedRoot);

  return isMatch;
};
