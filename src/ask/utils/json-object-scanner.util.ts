// Tracks brace depth across chunks, skipping braces inside strings, so a caller parses only when a top-level object closes.
export const createJsonObjectScanner = (): ((chunk: string) => boolean) => {
  let depth = 0;
  let inString = false;
  let escaped = false;

  const scanStringChar = (char: string): void => {
    if (escaped) {
      escaped = false;

      return;
    }

    if (char === '\\') {
      escaped = true;

      return;
    }

    if (char === '"') inString = false;
  };

  const scanChar = (char: string): boolean => {
    if (inString) {
      scanStringChar(char);

      return false;
    }

    if (char === '{') depth += 1;

    if (depth === 0) return false;

    if (char === '"') inString = true;

    if (char !== '}') return false;

    depth -= 1;

    return depth === 0;
  };

  return (chunk: string): boolean => {
    let hasClosedObject = false;

    for (const char of chunk) {
      const closedObject = scanChar(char);

      if (closedObject) hasClosedObject = true;
    }

    return hasClosedObject;
  };
};
