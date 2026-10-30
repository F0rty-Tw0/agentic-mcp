import type { Mock } from 'vitest';

type ChildProcessLike = Record<string, unknown>;

export type ControllableChildStdin = {
  readonly write: Mock;
  readonly end: Mock;
};

export type ControllableChild = {
  readonly child: ChildProcessLike;
  readonly stdin: ControllableChildStdin;
  readonly emitClose: (exitCode: number | null, signal: string | null) => void;
  readonly emitError: (error: Error) => void;
  readonly emitStdout: (data: Buffer) => void;
  readonly emitStderr: (data: Buffer) => void;
};
