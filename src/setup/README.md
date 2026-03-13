# setup

MCP client configuration CLI — the `agentic-mcp setup` subcommand that detects installed provider CLIs and writes MCP client configuration files. The `agentic-mcp init` alias runs the same module in minimal mode so users can see what is detected, what remains unproven, and the next step before any client config is written.

## What It Does

- Detects which AI provider CLIs are installed on the system (Claude, Codex, Copilot, Gemini, OpenCode)
- Generates an MCP server entry (`agentic-mcp`) for the target client's config format
- Supports multiple MCP clients: Claude Code, VS Code, Cursor, Windsurf, and a generic JSON format
- Merges the generated entry into existing config files, preserving other servers
- Creates `.bak` backup files before modifying existing configs
- Supports `--dry-run` to preview changes without writing, `--yes` for non-interactive mode, and `--minimal` for skill-first onboarding
- Prints truthful output that separates what was configured, what was detected, what remains unproven, and the next command to prove real usage

## Output Contract

- Human output includes `What was done`, `Detected providers`, `What remains unproven`, and the next command or diagnostic step
- JSON output keeps the existing top-level fields and adds `summary.nextStep`, `summary.unproven`, and, for minimal mode, `summary.firstProofCommand`
- If a provider is detected, setup points to a concrete `prove <provider>` command
- If no provider is detected, setup points to the next diagnostic step instead of implying readiness

## Structure

| Directory       | Purpose                                                                         |
| --------------- | ------------------------------------------------------------------------------- |
| `common/`       | Client path definitions, setup types                                            |
| `domain-logic/` | Setup CLI orchestration, provider detection, config generation                  |
| `utils/`        | Setup plan builder, config file I/O (temp+rename+verify), CLI output formatting |

## Key Files

- `domain-logic/setup-cli.ts` — `runSetup()` — orchestrates the full setup flow with dependency injection for testability
- `domain-logic/detect-providers.ts` — Scans the system for installed provider binaries
- `domain-logic/generate-config.ts` — Generates the MCP server JSON entry
- `utils/apply-setup-plan.util.ts` — Atomic file write using temp file + rename + verification

## Integration Tests

Run with: `pnpm run test:integration`

### `setup-cli.test.ts`

Exercises the setup CLI with real filesystem operations in a temp directory. Uses `runSetup()` with injected dependencies (stubbed provider detection, captured stdout/stderr, temp home directory, non-interactive mode).

| Test                        | What It Verifies                                                                                             | Expected Output                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Fresh config write          | With `--yes` and `--path`, a valid config file is created containing `mcpServers["agentic-mcp"]`             | Parsed JSON has `mcpServers` with `agentic-mcp` entry, and stdout points to the first real-use command |
| Merge with existing config  | When an existing config has `other-server`, running setup preserves it alongside the new `agentic-mcp` entry | Both `other-server` and `agentic-mcp` exist in `mcpServers`                                            |
| Backup creation             | When `--backup` is passed with an existing config, a `.bak` file is created with the original content        | `.bak` file content matches the original config                                                        |
| Non-interactive safety gate | Without `--yes` in non-interactive mode, setup aborts with an error and does not write any file              | stderr contains `"non-interactive write requires explicit --yes"`; target file does not exist          |
| Dry run                     | With `--dry-run`, output is produced but no file is written to disk                                          | stdout length > 0; target file does not exist                                                          |
| Minimal setup               | With `--minimal`, the skill is installed and the next real-proof command is surfaced                         | skill file exists; stdout explains what remains unproven and shows the first real-proof command        |

## Unit Tests

8 `.spec.ts` files covering the setup CLI orchestration, provider detection, config generation, setup plan building, config merging, output formatting, and file I/O utilities.
