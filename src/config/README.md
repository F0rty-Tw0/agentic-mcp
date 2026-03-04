# config

Provider configuration loader — resolves and validates `providers.json` from multiple sources with Zod schema enforcement.

## What It Does

- Resolves the config file path from four sources in priority order:
  1. Explicit `--config` CLI flag
  2. `AGENTIC_MCP_CONFIG` environment variable
  3. User-local config (`~/.config/agentic-mcp/providers.json` on Unix, `%APPDATA%/agentic-mcp/providers.json` on Windows)
  4. Bundled default `providers.json` shipped with the package
- Reads and parses the JSON file
- Validates the config against a Zod schema (`providersFileSchema`) to catch misconfiguration early
- Warns on dangerous auto-mode flags (e.g., `--dangerously-skip-permissions`, `--yolo`)

## Key Files

- `loader.ts` — `loadConfig()` — multi-source config resolution and Zod validation
- `providers.json` — Default provider configurations for Claude, Codex, Copilot, Gemini, and OpenCode
- `providers.schema.json` — JSON Schema (generated from Zod) for external tooling

## Integration Tests

None. Config loading is exercised indirectly through `server/` integration tests (which call `createServer()` -> `loadConfig()`). The `entry/` integration test also exercises the invalid `--config` path error flow. Direct integration testing would require controlling the filesystem config resolution chain, which is covered by unit tests with mocked `fs` operations.

## Unit Tests

2 `.spec.ts` files:

- `loader.spec.ts` — Config resolution priority, file reading, Zod validation, error handling
- `providers-config.spec.ts` — Schema validation, provider structure, dangerous flag detection
