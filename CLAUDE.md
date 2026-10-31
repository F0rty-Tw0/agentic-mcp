# CLAUDE.md

## Gotchas

- **`pnpm run`** — always `pnpm run <script>`, never bare `pnpm <script>`.
- **No extensions on relative imports** — use `'./foo'`, never `'./foo.ts'` or `'./foo.js'`. Package imports use the specifier the package exports, extension included only when the export has one (`'@modelcontextprotocol/server/stdio'`).
- **Config over code** — new providers go in `providers.json`, not in source files. No code changes, no rebuilds.
- **Never `shell: true`** — all spawns use `cross-spawn` with array args. Never pass user input through a shell.

## Architecture

- Multi-model AI gateway wrapping CLI tools as MCP servers: Claude, Codex, Copilot, Gemini, OpenCode (stable) and Antigravity `agy` (beta), plus the other beta/community CLIs and disabled templates in `providers.json`
- Config-driven: providers defined in `src/config/providers.json` with Zod-validated schema (`providers.schema.json`)
- Entry point: `src/index.ts` -> `src/entry/domain-logic/entry.ts` (handles --version, --help, setup subcommand, or starts MCP server)

## Module Map

- `ask/` — per-provider ask handler (command building, execution, response parsing, sessions)
- `ask-all/` — fan-out to all providers in parallel
- `background-jobs/` — async job queue for long-running asks (mode: async, action: status)
- `cli-args/` — declarative config -> CLI string[] arg builder
- `config/` — providers.json loader with multi-source resolution (--config, env, user-local, bundled)
- `entry/` — CLI entry point (--version, --help, setup, MCP server)
- `provider-metrics/` — per-provider call counts, response times, success rates
- `server/` — MCP server factory
- `session/` — session store with locking for multi-turn conversations
- `setup/` — `agentic-mcp setup` CLI for configuring MCP clients
- `shared/` — cross-cutting: command-execution (spawning, semaphore), mcp-protocol (types, heartbeat), provider (config types, env resolver, model error detection), validation (argument validators, ValidationError)
- `simple-tools/` — ping, help, list_providers handlers
- `streaming/` — live output streaming via MCP progress notifications
- `tool-registry/` — MCP tool registration (builds tool definitions from provider config)
- `types/` — ambient declarations (build-env.d.ts)

## MCP Tools Exposed

Per enabled provider whose CLI is installed (12 enabled in the bundled `providers.json`, so up to 12x each):

- `ask_<provider>` — query a provider
- `sessions_<provider>` — list known sessions (if provider supports sessions)
- `ping_<provider>` — check readiness
- `help_<provider>` — show capabilities

Global:

- `ask_all` — fan-out to all providers
- `provider_metrics` — session call stats
- `list_providers` — available providers and status

## Key Patterns

- **Folder structure**: each module uses `domain-logic/`, `common/`, `utils/` subdirs with barrel `index.ts`; test-only files in `test/`
- **Stubs**: `test/stubs/*.stub.ts` constants and `test/utils/*.spec.util.ts` `create*`/`build*` factories (never `common/stubs/`)
- **Named return variables**: `const result = ...; return result;` (not inline returns)
- **Guard-first**: early returns over nested blocks
- **`readonly` properties**: primitive properties `readonly`, arrays as `T[]` (lint-suite enforces)

## Build & Test

- Build: `pnpm run build` (esbuild via `build.mjs`)
- Dev: `pnpm run dev` (tsx)
- Unit tests: `pnpm run test` (vitest, `.spec.ts` files co-located)
- Integration tests: `pnpm run test:integration` (separate vitest config, `.test.ts` files)
- Type-check: `pnpm run typecheck` (TypeScript 7 `tsc`; `.pnpmfile.cjs` gives typescript-eslint and lint-suite TypeScript 6, since TS 7 has no JS API)
- Lint: `pnpm run lint`
- Format: `pnpm run format`
- Validate providers config: `pnpm run validate:providers`

## Git

- **PRs target `dev`**, not `master`. Flow: `feat/x` -> PR -> `dev` -> PR -> `master`.
- **Commit format:** `type(scope): emoji message` — e.g. `feat(config): ✨ add Zod schema for providers`.
- **Squash merge only.** Auto-delete branches after merge. Apply labels from `.github/labels.yml`.

## Code Style

See [`AGENTS.md`](./AGENTS.md) for coding conventions, testing rules, and TDD enforcement.
