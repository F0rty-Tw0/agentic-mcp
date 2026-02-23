# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**agentic-mcp** is a config-driven [MCP](https://modelcontextprotocol.io/) server that wraps any agentic CLI tool. Adding a new CLI provider means adding an entry to `providers.json` — no code changes, no rebuilds.

Status: in active development. Core features are functional — config loading, tool registration, spawn execution, streaming, async jobs, sessions, provider attribution, usage stats, multi-provider querying (`ask_all`), and a setup CLI. Five providers configured: claude, codex, copilot, gemini, opencode.

## Commands

Always use `pnpm run` to execute scripts (not bare `pnpm <script>`).

```bash
pnpm install                # install dependencies
pnpm run build              # bundle with esbuild (src/index.ts → dist/index.js + providers.json)
pnpm run dev                # run server in dev mode (node --experimental-strip-types)
pnpm run start              # run compiled server (node dist/index.js)
pnpm run test               # run unit tests (vitest)
pnpm run test:integration   # run integration tests (vitest, separate config)
pnpm run validate:providers # validate providers.json against Zod schema
pnpm run typecheck          # type-check without emitting (tsc --noEmit)
pnpm run lint               # lint src/ with eslint
pnpm run lint:fix           # lint + auto-fix
```

## Architecture

```
build.mjs              # esbuild bundler script (shebang injection, providers.json copy)
src/
  index.ts              # entry point — shebang, start server, parse --config flag, setup subcommand
  server.ts             # MCP server setup, provider resolution, tool registration

  shared/               # cross-cutting infrastructure used by multiple features
    common/             # types, constants, Zod schemas, error classes
      errors/           # custom error classes and MCP error mapping
      command-executor.types.ts  # ExecuteCommandOptions, ExecutionResult types
      tool-definition.types.ts   # ToolDefinition, ToolAnnotations types
      provider-config.schema.ts  # Zod schemas for providers.json
      provider-config.type.ts    # ResolvedProviderEntry, ResolvedProvider types
      execution-limits.const.ts  # output size limits (MAX_PROMPT_BYTES, MAX_FILES, etc.)
      progress-context.types.ts  # ProgressContext (requestId, signal, notifications)
      test-utils/       # shared test helpers (Vitest utility types)
    utils/              # pure utility functions
      platform.ts       # binary resolution (which), process management, env isolation
      to-mcp-error.ts   # converts errors to MCP error responses
    domain-logic/       # orchestration and composition
      command-executor.ts # spawn execution with concurrency control and output limiting
      semaphore.ts      # concurrency control via semaphore (max concurrent spawns)
      request-registry.ts # tracks active requests for cancellation support

  session/              # session management (native session IDs, context prepend)
    session-id-extractor.ts  # extracts native session IDs from provider output

  feature/
    ask/                # core prompting feature — the main "ask" tool
      common/           # types and constants
        command-def.const.ts   # FLAG_* constants for ask command flags
        tool-args.types.ts     # AskToolArgs and BuiltArgs types
        attribution.types.ts   # ProviderAttribution type
        ask-job.types.ts       # async job types (AskJob, AskJobStatus)
        stream-event.types.ts  # streaming event types (start, chunk, done, error)
        session-mode.type.ts   # SessionMode type (none, tier1-prepend, tier2-native)
      utils/            # validation and helper functions
        validation.ts        # input validation helpers (prompt, model, sandbox, etc.)
        command-def-utils.ts # helpers for accessing command definitions and flags
      data-access/      # in-memory stores
        ask-job-store.ts     # async job store (bounded Map, FIFO pruning)
      domain-logic/     # core business logic
        ask.handler.ts           # handleAsk — orchestrates arg building, spawn, response
        ask-runner.util.ts       # runAskInvocation — execution with heartbeat, attribution, usage tracking
        ask-run-command.util.ts  # executeAndBuildResponse — lower-level spawn + response building
        ask-handler.util.ts      # shared helpers (env, args, failure building, model hints)
        ask-session-flow.util.ts # session tier orchestration (tier1 → tier2 fallback)
        ask-stream-notifier.util.ts # streaming notification emitter
        attribution.builder.ts   # buildAttribution — constructs ProviderAttribution metadata
        output-parser.util.ts    # parseProviderOutput — extracts text + metadata from raw output
        sessions.handler.ts      # handleAskWithSession — session-aware ask handler
        arg.builder.ts           # builds CLI argument arrays from tool args + provider config
        tool.builder.ts          # builds ask MCP tool definition (name, Zod schema, annotations)
    ask-all/            # multi-provider comparison tool — ask_all
      common/           # types and constants
        ask-all.types.ts   # AskAllToolArgs, AskAllProviderResult, AskAllResult
        ask-all.const.ts   # ASK_ALL_TOOL_NAME constant
      domain-logic/     # handler and tool builder
        ask-all.handler.ts      # handleAskAll — fans out to handleAsk per provider via Promise.all
        ask-all.handler.spec.ts # tests with mocked handleAsk
        tool.builder.ts         # builds ask_all tool definition
    usage-stats/        # per-provider call tracking — usage_summary tool
      common/           # types and constants
        usage-stats.types.ts  # ProviderCallRecord, ProviderStats, UsageSummary
        usage-stats.const.ts  # MAX_USAGE_RECORDS bound
      data-access/      # in-memory store
        usage-stats-store.ts  # recordCall(), getUsageSummary(), resetForTests()
      domain-logic/     # handler and tool builder
        usage-stats.handler.ts  # handleUsageSummary — returns JSON stats
        tool.builder.ts         # builds usage_summary tool definition
    simple-tools/       # lightweight tools: ping, help, list_providers
      domain-logic/     # handlers and tool builders
        ping.handler.ts # handlePing — version check via CLI spawn
        help.handler.ts # handleHelp — runs --help on provider CLI
        meta.handler.ts # handleListProviders — lists all configured providers
        tool.builder.ts # builds ping/help/list_providers tool definitions
    tool-registry/      # tool registration composition root
      tool-registry.ts  # registers all tools on the MCP server (ask, ask_all, usage_summary, ping, help, list_providers)

  setup/                # setup CLI — `npx agentic-mcp setup --client <client>`
    common/             # types and constants
      setup.types.ts      # SupportedClient, DetectedProvider, SetupResult
      setup.const.ts      # KNOWN_PROVIDER_COMMANDS, CLIENT_CONFIG_PATHS
    domain-logic/       # detection and config generation
      detect-providers.ts    # detectInstalledProviders — resolves each provider binary
      generate-config.ts     # generateClientConfig — outputs MCP client JSON
    setup-cli.ts        # runSetup — parses flags, detects, generates, optionally writes config

  config/               # config loading, validation, provider definitions
    loader.ts           # multi-source config resolution (CLI flag, env, user-local, bundled)
    validate-providers.ts # standalone script — validates providers.json against Zod schema
  types/                # ambient declarations (.d.ts for untyped packages + build-time env)
```

### Folder Roles

| Folder                               | Purpose                                                               | Contains                                                                               |
| ------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `shared/`                            | Cross-cutting infrastructure used by multiple features.               | Organized into `common/`, `utils/`, and `domain-logic/` sublayers.                     |
| `shared/common/`                     | Types, constants, schemas shared across features.                     | Zod schemas, type definitions, constants, error classes.                               |
| `shared/common/errors/`              | Error definitions and MCP error mapping.                              | Custom error classes (the one case where classes are acceptable — see Code Style).     |
| `shared/common/test-utils/`          | Shared test utilities.                                                | Vitest helper types (`vi-fn.types.ts`).                                                |
| `shared/utils/`                      | Pure utility functions.                                               | Platform helpers (binary resolution, env isolation), error conversion, heartbeat.      |
| `shared/domain-logic/`               | Orchestration and composition.                                        | Command executor (spawn + concurrency), semaphore, request registry.                   |
| `session/`                           | Session management across providers.                                  | Native session ID extraction from provider output.                                     |
| `feature/ask/`                       | Self-contained ask feature — the core prompting tool.                 | Organized into `common/`, `utils/`, `data-access/`, and `domain-logic/` sublayers.     |
| `feature/ask/common/`                | Ask-specific types and constants.                                     | FLAG\_\* constants, AskToolArgs, ProviderAttribution, streaming/session/job types.     |
| `feature/ask/utils/`                 | Ask-specific validation and helpers.                                  | Input validation (prompt, model, files), command-def access helpers.                   |
| `feature/ask/data-access/`           | Ask in-memory stores.                                                 | Async job store (bounded Map, FIFO pruning).                                           |
| `feature/ask/domain-logic/`          | Ask core business logic.                                              | Handler, runner, attribution builder, stream notifier, output parser, arg/tool builders.|
| `feature/ask-all/`                   | Multi-provider comparison tool (`ask_all`).                           | Fans out to `handleAsk` per provider, aggregates results.                              |
| `feature/usage-stats/`               | Per-provider call tracking (`usage_summary` tool).                    | In-memory store, handler, tool builder.                                                |
| `feature/simple-tools/`              | Lightweight tools grouped together (ping, help, list_providers).      | All files in `domain-logic/` sublayer.                                                 |
| `feature/simple-tools/domain-logic/` | Handlers and tool builders for simple tools.                          | ping, help, meta handlers and tool definition builders.                                |
| `feature/tool-registry/`             | Tool registration composition root.                                   | Registers all tools (ask, ask\_all, usage\_summary, ping, help, list\_providers).      |
| `setup/`                             | Setup CLI (`npx agentic-mcp setup --client <client>`).                | Provider detection, client config generation, interactive setup flow.                  |
| `config/`                            | Everything related to loading, parsing, and validating configuration. | `providers.json`, JSON schemas, Zod validation, config spec tests.                     |
| `types/`                             | Ambient declarations and build-time type definitions.                 | `.d.ts` files (untyped package declarations + `build-env.d.ts` for `__APP_VERSION__`). |

### Core Design Principles

- **Config over code** — provider behaviour lives in `providers.json`, not in source files.
- **Zod validation** on all inputs.
- **`spawn()` with array args** — never pass user input through a shell. Child environments are isolated (minimal base env, not full `process.env`).
- **Output size-limited** to prevent memory exhaustion.
- CLI binary paths are resolved and pinned at startup.
- **Generic command shape** — all CLI commands use a single `commandDef` schema (`args`, `trailingArgs`, `flags`). No bespoke per-command schemas. Capabilities are derived from command/flag presence, not declared separately.

### Provider Config Schema

Provider commands use a single generic `commandDef` shape instead of bespoke schemas per command type. This keeps the schema stable — new providers and capabilities are added by editing `providers.json` only (no schema changes).

**`commandDef` structure:**

```jsonc
{
  "args": ["exec"], // static leading args (subcommands, flags)
  "trailingArgs": ["--json"], // static trailing args (output format, etc.)
  "flags": {
    // named dynamic flags — open map, any key
    "model": "-m", // string → value flag (takes an argument)
    "autoMode": ["--full-auto"], // string[] → standalone args (appended as-is)
    "sandbox": {
      // object → leveled flag (constrained values)
      "flag": "--sandbox",
      "values": ["read-only", "workspace-write"],
    },
    "file": null, // null → supported conceptually, no CLI flag
  },
}
```

**Key rules:**

- Every provider must have an `ask` command
- `outputFormat` (`json` | `stream-json` | `text`) is a top-level provider property
- No `capabilities` object — capability is implied by command/flag presence (e.g. `commands.review` exists → provider supports review)
- MCP tools follow the pattern `{command}_{provider}` (e.g. `ask_claude`, `review_codex`)
- Global tools (not per-provider): `ask_all`, `usage_summary`, `list_providers`

## Dependencies & Decisions

Every dependency and tooling choice is documented here with rationale.

### Runtime

| Package                     | Why                                                                                                                                                                                                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@modelcontextprotocol/sdk` | Official MCP TypeScript SDK (v1.x). Provides server scaffolding, tool registration, and stdio transport. Pinned to v1 for production stability (v2 is pre-alpha).                                                                                                                                  |
| `zod`                       | Runtime schema validation. Validates `providers.json` at startup and all tool inputs at call time. Chosen over alternatives (joi, yup) for TypeScript-first design and zero dependencies.                                                                                                          |
| `cross-spawn`               | Cross-platform drop-in for `child_process.spawn()`. On Windows, Node's native `spawn()` fails for `.cmd`/`.bat` wrappers (which is how npm-installed CLIs like `claude`, `codex`, `gemini` are exposed). We refuse `shell: true` (shell injection risk), so `cross-spawn` is the safe alternative. |
| `which`                     | Cross-platform binary path resolver (like Unix `which`). Finds the absolute path of a CLI binary by searching PATH. We resolve and pin paths at startup so all spawns use absolute paths — prevents PATH manipulation attacks at runtime.                                                          |

### Dev — Build

| Package              | Why                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript`         | Type-checker only (`noEmit: true`). Strict mode, targeting ES2024 + NodeNext modules. tsgo-forward-compatible config (no enums, no namespaces, explicit types). |
| `esbuild`            | Production bundler. Bundles `src/index.ts` → `dist/index.js` with shebang injection and copies `providers.json` to `dist/`. Used via `build.mjs`.               |
| `vitest`             | Test runner. Fast, ESM-native, compatible with the project's TypeScript setup. Used for unit tests (`pnpm run test`).                                           |
| `@types/node`        | Node.js type definitions. Explicitly listed in `tsconfig.json` `types: ["node"]` to anticipate TS 6.0 default of empty `types`.                                 |
| `@types/cross-spawn` | Type definitions for `cross-spawn` (no bundled types).                                                                                                          |

### Dev — Lint

| Package                  | Why                                                           |
| ------------------------ | ------------------------------------------------------------- |
| `eslint`                 | Linter. ESLint 9 flat config.                                 |
| `prettier`               | Code formatter. Consistent formatting across the codebase.    |
| `lint-suite`             | Shared lint configuration preset.                             |
| `eslint-config-prettier` | Disables ESLint rules that conflict with Prettier formatting. |

### tsconfig Decisions

| Option                             | Value      | Why                                                                                                                                                                                     |
| ---------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `target`                           | `es2024`   | Matches Node 22+ runtime capabilities (engine floor). Avoids unnecessary downleveling.                                                                                                  |
| `module` / `moduleResolution`      | `nodenext` | Tracks latest Node.js ESM semantics. Supports import attributes for JSON imports.                                                                                                       |
| `allowImportingTsExtensions`       | `true`     | Permits `.ts` extensions in import specifiers. Safe because `noEmit: true` — no compiled `.js` output needs valid paths. Enables `node --experimental-strip-types` for dev without tsx. |
| `strict`                           | `true`     | Baseline strict checks (nulls, any, this, bind/call/apply, property init).                                                                                                              |
| `noUncheckedIndexedAccess`         | `true`     | Adds `\| undefined` to indexed access — forces handling missing keys/elements.                                                                                                          |
| `noImplicitOverride`               | `true`     | Requires `override` keyword on overridden methods. Prevents accidental shadowing.                                                                                                       |
| `noImplicitReturns`                | `true`     | Errors on code paths that don't explicitly return in functions with return types.                                                                                                       |
| `noUnusedLocals`                   | `true`     | Errors on declared but unused local variables. Keeps code clean.                                                                                                                        |
| `noUnusedParameters`               | `true`     | Errors on unused function parameters. Prefix with `_` to suppress when intentional.                                                                                                     |
| `noFallthroughCasesInSwitch`       | `true`     | Errors on switch cases that fall through without `break` or `return`.                                                                                                                   |
| `erasableSyntaxOnly`               | `true`     | Bans enums and namespaces. Aligns with Node native type-stripping, tsgo, and TC39 "types as comments" direction.                                                                        |
| `moduleDetection`                  | `force`    | Every file is a module. Prevents ambient-globals footgun where files without imports/exports become global scripts.                                                                     |
| `noUncheckedSideEffectImports`     | `true`     | Errors on unresolvable side-effect imports (`import "./missing.css"`). Catches typos. New in TS 5.6.                                                                                    |
| `verbatimModuleSyntax`             | `true`     | Requires `import type` for type-only imports. Emitted JS exactly mirrors import statements.                                                                                             |
| `isolatedModules`                  | `true`     | Each file transpilable in isolation. Belt-and-suspenders with `verbatimModuleSyntax`.                                                                                                   |
| `types`                            | `["node"]` | Explicit opt-in. Anticipates TS 6.0 which changes default from "all @types" to empty `[]`.                                                                                              |
| `noEmit`                           | `true`     | tsc is used only for type-checking (`pnpm run typecheck`). Production builds use esbuild via `build.mjs`.                                                                               |
| `skipLibCheck`                     | `true`     | Skips type-checking `.d.ts` files. Speeds up type-checking.                                                                                                                             |
| `forceConsistentCasingInFileNames` | `true`     | Prevents case-sensitivity bugs across platforms (Windows vs Linux file systems).                                                                                                        |
| `resolveJsonModule`                | _not set_  | Intentional. `providers.json` is loaded via `fs.readFile` + `JSON.parse` + Zod, not ESM `import`. This supports arbitrary config paths (CLI flag, env var) and graceful error handling. |

### Import Extensions

All relative imports use **`.ts` extensions** (e.g., `import { foo } from './bar.ts'`), not `.js`. This is required by Node's native type stripping (`--experimental-strip-types`), which does not resolve `.js` → `.ts`. Package imports retain their original extensions (e.g., `@modelcontextprotocol/sdk/server/mcp.js`). The `allowImportingTsExtensions` tsconfig option permits this; it's safe because `noEmit: true` means tsc never produces output files that would need valid JS paths. esbuild and vitest both resolve `.ts` extensions correctly.

### pnpm Catalog

Uses **named catalogs** (`catalogs:` plural) in `pnpm-workspace.yaml`. Dependencies are grouped into `runtime` and `dev`, referenced in `package.json` as `catalog:runtime` and `catalog:dev`. This keeps runtime and development dependencies clearly separated while preserving self-documenting dependency references.

Single-package workspace with `packages: ['.']` for catalog compatibility on all pnpm v10.x.

### Version Alignment

| Concern          | Value          | Rationale                                                                                                  |
| ---------------- | -------------- | ---------------------------------------------------------------------------------------------------------- |
| `engines.node`   | `>=22`         | Node 22 is current LTS (EOL April 2027). Aligns with `target: es2024`. Node 20 EOL is April 2026.          |
| `target` / `lib` | `es2024`       | Full ES2024 support guaranteed on Node 22+.                                                                |
| `@types/node`    | `^25.x`        | Provides latest type definitions. Backward-compatible with Node 22 core APIs.                              |
| `packageManager` | `pnpm@10.30.0` | Pinned for reproducible installs. Named catalogs require pnpm 9.5+; `catalogMode` settings require 10.12+. |

## Code Style

See [`AGENTS.md`](./AGENTS.md) for the full coding style guide, including TypeScript conventions, testing style (GIVEN/WHEN/THEN), TDD enforcement, functional programming preference, readonly-by-default rules, and linter validation requirements.

Import/export policy: barrel re-exporters (`index.ts`) are allowed only inside `common/`, `stubs/`, and `utils/` directories, and they should use named re-exports instead of wildcard re-exports.

## Git Workflow

| Branch                       | Purpose                                              |
| ---------------------------- | ---------------------------------------------------- |
| `master`                     | Protected production branch. PRs only, squash merge. |
| `dev`                        | Integration branch. Feature work merges here first.  |
| `feat/*`, `fix/*`, `chore/*` | Short-lived branches off `dev`                       |

Flow: `feat/x` → PR → `dev` → PR → `master`

**Commit convention:** `type(scope): emoji message`

```
feat(config):    ✨ add Zod schema for providers
fix(executor):   🐛 fix timeout on Windows
chore(deps):     📦 bump @modelcontextprotocol/sdk
docs(readme):    📝 add usage examples
test(session):   ✅ add session store unit tests
refactor(tools): ♻️  extract tool builder
```

Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`, `perf`

**PRs:** squash merge only, base branch is `dev` (not `master`), auto-delete branches after merge. Apply labels from `.github/labels.yml` (e.g. `phase-1`, `core`, `provider`).

## Keeping CLAUDE.md Current

This file is a living document. After every meaningful change to the codebase, update the relevant section here:

- **New command or script** — add it to Commands.
- **New module, directory, or architectural shift** — update Architecture.
- **New dependency added or removed** — update Dependencies & Decisions with rationale.
- **New convention or style rule** — add it to `AGENTS.md`.
- **New workflow or branch policy change** — update Git Workflow.
- **Phase milestone reached or new phase defined** — update Roadmap Phases.
- **New provider added** — note it under Architecture or a dedicated Providers section if the list grows.

If a section becomes outdated or wrong, fix it immediately rather than leaving stale guidance. Accuracy matters more than completeness.

## Roadmap Phases

1. **Core MVP** ✅ — config loading (multi-source resolution), Zod validation, tool registration (ask/ping/help/list_providers), spawn execution with concurrency control, output size limiting, cross-platform binary resolution, 5 providers configured (claude, codex, copilot, gemini, opencode)
2. **Sessions + streaming** ✅
   - Live ask stream contract implemented (`start`/`chunk`/`heartbeat`/`done`/`error`) via `notifications/progress`
   - Executor emits stdout/stderr chunk callbacks while preserving bounded output collection
   - `stream_live` opt-in added to ask tool schema
   - Async fallback added (`mode: 'async'`, `action: 'status'`, in-memory job store)
   - Terminal `CallToolResult` response contract preserved across streaming and async paths
3. **Value realization** ✅
   - Provider attribution in every ask response (`content[1]` — provider, model, timing, outputBytes, truncated, outputFormat)
   - Usage stats collector + `usage_summary` tool (in-memory per-provider call counts, execution times, success/failure rates)
   - `ask_all` meta-tool (fan out same prompt to multiple providers, aggregate results via `Promise.all`)
   - Setup CLI (`npx agentic-mcp setup --client <client>` — detects installed providers, generates MCP client config)
   - Value clarity rewrite (outcome-focused tool descriptions, README, package.json)
4. **Extended providers**
5. **Advanced features** — review, sandbox, npm publish
