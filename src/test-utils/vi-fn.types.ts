export type AsyncViFn<TArgs extends unknown[] = [], TResult = void> = (
  ...args: TArgs
) => Promise<TResult>;

export type SyncViFn<TArgs extends unknown[] = [], TResult = void> = (...args: TArgs) => TResult;
