type KeptTimeoutNoteInput = {
  readonly key?: string;
  readonly existingEntry: Readonly<Record<string, unknown>>;
  readonly toolTimeoutMs?: number;
};

// Setup never writes this key (Claude Code's per-server timeout is a hard limit), so a lower one the user set stays.
export const buildKeptTimeoutNote = (input: KeptTimeoutNoteInput): string | undefined => {
  const { key, existingEntry, toolTimeoutMs } = input;

  if (key == null || toolTimeoutMs == null) return undefined;

  const existingValue = existingEntry[key];

  if (typeof existingValue !== 'number' || existingValue >= toolTimeoutMs) return undefined;

  const kept = String(existingValue);
  const derived = String(toolTimeoutMs);
  const note = `agentic-mcp ${key}: kept your ${kept} ms, but it is lower than the ${derived} ms tool-call timeout, so it cuts long provider runs short; remove it to use Claude Code's default, or raise it to at least ${derived}.`;

  return note;
};
