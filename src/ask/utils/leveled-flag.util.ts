import type { FlagValue } from '../../shared/provider/common';

type LeveledFlag = { readonly flag: string; values: string[] };

export const isLeveledFlag = (value: FlagValue): value is LeveledFlag => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};
