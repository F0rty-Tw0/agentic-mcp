type JsonRecord = Readonly<Record<string, unknown>>;

type DisabledFlag = {
  readonly key: string;
  readonly disabledValue: boolean;
};

// Clients spell a turned-off server "disabled": true (agy, Windsurf) or enabled = false (OpenCode, Codex).
const DISABLED_FLAGS: DisabledFlag[] = [
  { key: 'disabled', disabledValue: true },
  { key: 'enabled', disabledValue: false },
];

// The merge keeps the user's flag, since re-enabling a server they turned off would be a silent surprise.
export const buildDisabledEntryWarnings = (existingEntry: JsonRecord): string[] => {
  const disabledFlags = DISABLED_FLAGS.filter((flag) => existingEntry[flag.key] === flag.disabledValue);
  const warnings = disabledFlags.map(({ key, disabledValue }) => {
    const setting = `"${key}": ${String(disabledValue)}`;
    const enabling = `Set "${key}" to ${String(!disabledValue)} or remove it to use agentic-mcp.`;

    return `The agentic-mcp entry is disabled in the client config (${setting}), so the client will not start it; setup kept it disabled. ${enabling}`;
  });

  return warnings;
};
