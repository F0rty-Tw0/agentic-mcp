# entry

CLI entry point — the first code that runs when the `agentic-mcp` binary is executed. Routes to the appropriate handler based on CLI flags.

## What It Does

- `--version` — prints the application version (from `APP_VERSION` build constant) and exits
- `--help` — prints usage information and exits
- `setup` subcommand — delegates to the setup CLI for configuring MCP clients
- Default — starts the MCP server on stdio transport for normal operation

## Structure

| Directory       | Purpose                           |
| --------------- | --------------------------------- |
| `common/`       | Help text constant                |
| `domain-logic/` | Main `entry()` function           |
| `utils/`        | Config path parsing from CLI args |

## Key Files

- `domain-logic/entry.ts` — `entry()` — the main async entry point that parses process.argv and routes accordingly

## Integration Tests

Run with: `pnpm run test:integration`

**Prerequisite:** The binary must be built first with `pnpm run build` (produces `dist/index.cjs`).

### `entry.test.ts`

Exercises the CLI entry point end-to-end by spawning the built binary as a real child process. Tests gracefully skip if the binary has not been built.

| Test                    | What It Verifies                                                                           | Expected Output                                         |
| ----------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Binary not built (skip) | When `dist/index.cjs` doesn't exist, tests skip gracefully with a warning                  | Console warning printed; `binaryExists` is `false`      |
| `--version` flag        | Spawning the binary with `--version` prints a semver-like version string and exits cleanly | stdout matches `/\d+\.\d+\.\d+/`                        |
| `--help` flag           | Spawning the binary with `--help` prints usage information and exits cleanly               | stdout length > 0; text matches `/agentic-mcp\|usage/i` |
| Invalid `--config` path | Spawning with `--config /nonexistent/path.json` exits with non-zero code and stderr output | Exit code is not 0; stderr is truthy                    |

## Unit Tests

1 `.spec.ts` file covering the entry function routing logic with mocked dependencies.
