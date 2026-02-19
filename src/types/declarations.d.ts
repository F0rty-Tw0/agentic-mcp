// Ambient module declarations for packages that ship no bundled types.
// @types/which exists but only covers v3.x — we use which@6.

declare module 'which' {
  type WhichOptions = {
    path?: string;
    pathExt?: string;
    all?: boolean;
    nothrow?: boolean;
  };

  function which(cmd: string, options?: WhichOptions & { all?: false; nothrow?: false }): Promise<string>;
  function which(cmd: string, options: WhichOptions & { all: true }): Promise<string[]>;
  function which(cmd: string, options: WhichOptions & { nothrow: true }): Promise<string | null>;

  namespace which {
    function sync(cmd: string, options?: WhichOptions & { all?: false; nothrow?: false }): string;
    function sync(cmd: string, options: WhichOptions & { all: true }): string[];
    function sync(cmd: string, options: WhichOptions & { nothrow: true }): string | null;
  }

  export = which;
}
