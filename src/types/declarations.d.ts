// Ambient module declarations for packages that ship no bundled types.
// @types/which exists but only covers v3.x — we use which@6.

declare module 'which' {
  type WhichOptions = {
    readonly path?: string;
    readonly pathExt?: string;
    readonly all?: boolean;
    readonly nothrow?: boolean;
  };

  type WhichSingleFlags = {
    readonly all?: false;
    readonly nothrow?: false;
  };

  type WhichAllFlags = {
    readonly all: true;
  };

  type WhichNothrowFlags = {
    readonly nothrow: true;
  };

  type WhichSync = {
    (cmd: string, options?: WhichOptions & WhichSingleFlags): string;
    (cmd: string, options: WhichOptions & WhichAllFlags): string[];
    (cmd: string, options: WhichOptions & WhichNothrowFlags): string | null;
  };

  type Which = {
    (cmd: string, options?: WhichOptions & WhichSingleFlags): Promise<string>;
    (cmd: string, options: WhichOptions & WhichAllFlags): Promise<string[]>;
    (cmd: string, options: WhichOptions & WhichNothrowFlags): Promise<string | null>;
    readonly sync: WhichSync;
  };

  const which: Which;

  export = which;
}
