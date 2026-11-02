# setup

MCP client configuration CLI — the `agentic-mcp setup` subcommand that detects installed provider CLIs and writes MCP client configuration files. The `agentic-mcp init` alias runs the same module in minimal mode so users can see what is detected, what remains unproven, and the next step before any client config is written.

## What It Does

- Detects which AI provider CLIs are installed on the system (Claude, Codex, Copilot, Gemini, Antigravity `agy`, OpenCode)
- Generates an MCP server entry (`agentic-mcp`) for the target client's config format, with the client's tool-call timeout above the longest provider timeout plus queue wait in the loaded providers config (`CLIENT_TOOL_TIMEOUT_MS` when it cannot be loaded) where the client has a per-server key; Claude Code gets none, since its default limit is longer and a per-server `timeout` would replace it
- Supports multiple MCP clients: Claude Code, Codex CLI (TOML), Copilot CLI, Gemini CLI, Antigravity (`~/.gemini/config/mcp_config.json`, `timeoutSeconds` in seconds), OpenCode, Cursor, Windsurf, and a generic JSON format
- Merges the generated entry into existing config files, preserving other servers and keys; inside the `agentic-mcp` entry it keeps the user's own keys and raises a timeout key only when it is missing or lower. An `agentic-mcp` entry with `url`, `httpUrl` or `serverUrl` (a remote server), or a TOML `mcp_servers` that is not a table, is left for a manual edit (status `unmergeable`)
- Merges Codex's `config.toml` with `smol-toml`: appends a new table so comments stay, rewrites the file only to update an existing table (with a warning), and refuses a file that is not valid TOML or that a rewrite would change
- Creates `.bak` backup files before modifying existing configs; a merge that leaves the `agentic-mcp` entry as it is writes nothing and makes no backup (write intent and result `unchanged`, "already configured")
- Keeps a Claude Code `timeout` the user set, with a note when it is lower than the derived tool-call timeout, since it cuts long runs short
- Warns, when no `--path` is given, if a variable that moves the client's config (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `COPILOT_HOME`, `GEMINI_CLI_HOME`, `OPENCODE_CONFIG`, `XDG_CONFIG_HOME`) points at a file other than the one setup writes, and names that file
- Keeps an Antigravity `timeoutSeconds` of 0 or below, with a warning, since agy documents no meaning for it; the timeout rule's `keepsNonPositive` flag marks this, and only the agy rule sets it
- In merge mode, keeps the flag on a disabled `agentic-mcp` entry (`"disabled": true` or `enabled: false`), with a warning that the entry is marked disabled; `--mode overwrite` rewrites the entry without the flag
- Supports `--dry-run` to preview changes without writing any file (with `--minimal` it skips the skill install too), `--yes` for non-interactive mode, and `--minimal` for skill-first onboarding
- Exits 1 when aborted (the confirmation prompt is declined or closed, or a non-interactive write lacks `--yes`); with `--output json` it prints `result.status: "aborted"` and the reason. The prompt goes to stderr
- Exits 1 when the written file fails its read-back check (`verification-failed`), and then skips the Claude Code skill install (`skillResult.status: "skipped"` with the reason)
- Exits 1 when an existing config is left for a manual edit because setup will not merge into it (invalid JSON or TOML, an unmergeable entry, a TOML entry setup cannot update safely, or `--mode overwrite` on Claude Code's state file); the output is unchanged (`result.status: "manual"`). A client with no known config path (`--client generic` without `--path`) still exits 0, since printing the snippet is its normal outcome
- Prints truthful output that separates what was configured, what was detected, what remains unproven, and the next command to prove real usage

## Output Contract

- Human output includes `What was done`, `Detected providers`, `What remains unproven`, and the next command or diagnostic step
- JSON output keeps the existing top-level fields and adds `summary.nextStep`, `summary.unproven`, and, for minimal mode, `summary.firstProofCommand`
- If a provider is detected, setup points to a concrete `prove <provider>` command
- If no provider is detected, setup points to the next diagnostic step instead of implying readiness

## Structure

| Directory       | Purpose                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| `common/`       | Client targets (path, format, servers key, timeout keys), setup types    |
| `domain-logic/` | Setup CLI orchestration, provider detection, config generation, file I/O |
| `utils/`        | Setup plan builder, config merging, CLI output formatting                |
| `test/`         | Test-only constants, types, and spec utils                               |

## Key Files

- `domain-logic/setup-cli.ts` — `runSetup()` — orchestrates the full setup flow with dependency injection for testability
- `domain-logic/detect-providers.ts` — Scans the system for installed provider binaries
- `domain-logic/generate-config.ts` — Generates the per-client MCP server entry, including its timeout keys
- `utils/merge-server-entry.util.ts` — Merges the `agentic-mcp` entry key by key and never lowers a timeout
- `utils/choose-timeout.util.ts` — Picks each timeout key's value (kept, raised, or kept at 0 or below for a `keepsNonPositive` rule)
- `utils/disabled-entry-warning.util.ts` — Warns when the existing entry is disabled
- `utils/setup-abort.util.ts` — Reports an aborted run (exit code 1, JSON `aborted` result)
- `utils/setup-cli-runner.util.ts` — Runs the minimal and configured flows: consent, apply, skill install, exit code
- `utils/setup-plan-from-args.util.ts` — Turns the parsed args into a setup plan (target path, tool-call timeout, existing config)
- `utils/plan-setup.util.ts`, `utils/plan-warnings.util.ts` — Build the setup plan, its target path (`resolveTargetPath`, shared with `setup-plan-from-args`) and its warnings
- `utils/merge-client-config.util.ts`, `utils/merge-toml-client-config.util.ts` — JSON and TOML document merges
- `utils/resolve-client-tool-timeout.util.ts` — Derives the client tool-call timeout from the providers config and describes it in the output
- `utils/moved-config-warnings.util.ts` — Warns when an environment variable points the client at another config file
- `utils/parse-toml.util.ts` — Parses TOML into plain objects, keeping integers beyond 2^53 as BigInt
- `utils/verify-written-config.util.ts` — Parses the written file again and checks the entry is there
- `domain-logic/apply-setup-plan.ts` — Atomic file write using temp file + rename + verification
- `domain-logic/install-skill.ts` — Installs the `using-agentic-mcp` Claude Code skill

## Integration Tests

Run with: `pnpm run test:integration`

### `setup-cli.test.ts`

Exercises the setup CLI with real filesystem operations in a temp directory. Uses `runSetup()` with injected dependencies (stubbed provider detection, captured stdout/stderr, temp home directory, non-interactive mode).

| Test                        | What It Verifies                                                                                             | Expected Output                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Fresh config write          | With `--yes` and `--path`, a valid config file is created containing `mcpServers["agentic-mcp"]`             | Parsed JSON has `mcpServers` with `agentic-mcp` entry, and stdout points to the first real-use command     |
| Merge with existing config  | When an existing config has `other-server`, running setup preserves it alongside the new `agentic-mcp` entry | Both `other-server` and `agentic-mcp` exist in `mcpServers`                                                |
| Backup creation             | When `--backup` is passed with an existing config, a `.bak` file is created with the original content        | `.bak` file content matches the original config                                                            |
| Non-interactive safety gate | Without `--yes` in non-interactive mode, setup aborts with an error and does not write any file              | stderr contains `"non-interactive write requires explicit --yes"`; exit code 1; target file does not exist |
| Dry run                     | With `--dry-run`, output is produced but no file is written to disk                                          | stdout length > 0; target file does not exist                                                              |
| Minimal setup               | With `--minimal`, the skill is installed and the next real-proof command is surfaced                         | skill file exists; stdout explains what remains unproven and shows the first real-proof command            |

### `setup-cli-process.test.ts`

Spawns the built binary (`dist/index.js`, so run `pnpm run build` first) with a scratch `HOME`. Skipped when the build is missing.

| Test                   | What It Verifies                                             | Expected Output                                                    |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| `--output json`        | stdout is one JSON document that includes the skill result   | `skillResult.status` is `installed`                                |
| Unchanged rerun        | A second run on a configured file writes nothing             | Same inode and mtime, no `.bak`, `result.status` is `unchanged`    |
| Invalid JSON in config | Setup leaves a config it cannot merge into for a manual edit | Exit code 1, `result` is `{ status: 'manual', path }`, file intact |

## Unit Tests

`.spec.ts` files covering the setup CLI orchestration, provider detection, per-client config generation, setup plan building, JSON and TOML config merging, timeout merging, written-file verification, output formatting, and file I/O utilities.
