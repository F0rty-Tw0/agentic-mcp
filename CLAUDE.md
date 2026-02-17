# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**agentic-mcp** is a config-driven [MCP](https://modelcontextprotocol.io/) server that wraps any agentic CLI tool. Adding a new CLI provider means adding an entry to `providers.json` — no code changes, no rebuilds.

Status: in early development (pre-source). Build tooling and source files are being established.

## Commands

```bash
pnpm install        # install dependencies
pnpm build          # compile TypeScript (tsc)
pnpm dev            # run server in dev mode (tsx, no build step)
pnpm start          # run compiled server (node dist/index.js)
pnpm typecheck      # type-check without emitting (tsc --noEmit)
pnpm lint           # lint src/ with eslint
pnpm lint:fix       # lint + auto-fix
```

## Architecture (planned)

```
providers.json          # provider definitions — the only file to touch when adding a CLI
src/
  index.ts              # entry point — shebang, start server
  server.ts             # MCP server setup, ListTools/CallTool handlers
  types.ts              # shared types / Zod schemas
  config/               # config loading and validation
  tools/                # MCP tool builders (ask_{provider}, ping_{provider}, etc.)
  session/              # session store (resume, continue)
  utils/                # shared helpers
```

Core design principles:
- **Config over code** — provider behaviour lives in `providers.json`, not in source files.
- **Zod validation** on all inputs.
- **`spawn()` with array args** — never pass user input through a shell. Child environments are isolated (minimal base env, not full `process.env`).
- **Output size-limited** to prevent memory exhaustion.
- CLI binary paths are resolved and pinned at startup.

## Dependencies & Decisions

Every dependency and tooling choice is documented here with rationale.

### Runtime

| Package | Why |
|---|---|
| `@modelcontextprotocol/sdk` | Official MCP TypeScript SDK (v1.x). Provides server scaffolding, tool registration, and stdio transport. Pinned to v1 for production stability (v2 is pre-alpha). |
| `zod` | Runtime schema validation. Validates `providers.json` at startup and all tool inputs at call time. Chosen over alternatives (joi, yup) for TypeScript-first design and zero dependencies. |
| `cross-spawn` | Cross-platform drop-in for `child_process.spawn()`. On Windows, Node's native `spawn()` fails for `.cmd`/`.bat` wrappers (which is how npm-installed CLIs like `claude`, `codex`, `gemini` are exposed). We refuse `shell: true` (shell injection risk), so `cross-spawn` is the safe alternative. |
| `which` | Cross-platform binary path resolver (like Unix `which`). Finds the absolute path of a CLI binary by searching PATH. We resolve and pin paths at startup so all spawns use absolute paths — prevents PATH manipulation attacks at runtime. |

### Dev — Build

| Package | Why |
|---|---|
| `typescript` | Compiler. Strict mode, targeting ES2024 + NodeNext modules. tsgo-forward-compatible config (no enums, no namespaces, explicit types). |
| `tsx` | TypeScript execution engine (esbuild-based). Runs `.ts` files directly without a build step. Used for `pnpm dev` during development. Faster and ESM-native unlike the older `ts-node`. |
| `@types/node` | Node.js type definitions. Explicitly listed in `tsconfig.json` `types: ["node"]` to anticipate TS 6.0 default of empty `types`. |
| `@types/cross-spawn` | Type definitions for `cross-spawn` (no bundled types). |

### Dev — Lint

| Package | Why |
|---|---|
| `eslint` | Linter. ESLint 9 flat config. |
| `eslint-config-prettier` | Disables ESLint rules that conflict with Prettier formatting. |
| `lint-suite` | Shared lint configuration preset. |

### tsconfig Decisions

| Option | Value | Why |
|---|---|---|
| `target` | `es2024` | Matches Node 22+ runtime capabilities (engine floor). Avoids unnecessary downleveling. |
| `module` / `moduleResolution` | `nodenext` | Tracks latest Node.js ESM semantics. Supports import attributes for JSON imports. |
| `strict` | `true` | Baseline strict checks (nulls, any, this, bind/call/apply, property init). |
| `noUncheckedIndexedAccess` | `true` | Adds `\| undefined` to indexed access — forces handling missing keys/elements. |
| `erasableSyntaxOnly` | `true` | Bans enums and namespaces. Aligns with Node native type-stripping, tsgo, and TC39 "types as comments" direction. |
| `moduleDetection` | `force` | Every file is a module. Prevents ambient-globals footgun where files without imports/exports become global scripts. |
| `noUncheckedSideEffectImports` | `true` | Errors on unresolvable side-effect imports (`import "./missing.css"`). Catches typos. New in TS 5.6. |
| `verbatimModuleSyntax` | `true` | Requires `import type` for type-only imports. Emitted JS exactly mirrors import statements. |
| `isolatedModules` | `true` | Each file transpilable in isolation. Belt-and-suspenders with `verbatimModuleSyntax`. |
| `types` | `["node"]` | Explicit opt-in. Anticipates TS 6.0 which changes default from "all @types" to empty `[]`. |
| `incremental` | `true` | Faster rebuilds. Compatible with tsgo. |
| `noEmitOnError` | `true` | Prevents emitting broken JS when type errors exist. Safety net for `pnpm build`. |
| `resolveJsonModule` | *not set* | Intentional. `providers.json` is loaded via `fs.readFile` + `JSON.parse` + Zod, not ESM `import`. This supports arbitrary config paths (CLI flag, env var) and graceful error handling. |

### pnpm Catalog

Uses **named catalogs** (`catalogs:` plural) in `pnpm-workspace.yaml`. Each group is a separate named catalog (`runtime`, `build`, `lint`), referenced in `package.json` as `catalog:runtime`, `catalog:build`, `catalog:lint`. This makes every dependency reference self-documenting and allows per-group policy enforcement.

Single-package workspace with `packages: ['.']` for catalog compatibility on all pnpm v10.x.

### Version Alignment

| Concern | Value | Rationale |
|---|---|---|
| `engines.node` | `>=22` | Node 22 is current LTS (EOL April 2027). Aligns with `target: es2024`. Node 20 EOL is April 2026. |
| `target` / `lib` | `es2024` | Full ES2024 support guaranteed on Node 22+. |
| `@types/node` | `^25.x` | Provides latest type definitions. Backward-compatible with Node 22 core APIs. |
| `packageManager` | `pnpm@10.29.3` | Pinned for reproducible installs. Named catalogs require pnpm 9.5+; `catalogMode` settings require 10.12+. |

## Code Style

- TypeScript strict mode (see tsconfig decisions above)
- No enums, no namespaces (`erasableSyntaxOnly`)
- 2-space indent, LF line endings, UTF-8 (see `.editorconfig`)
- Line endings normalised to LF via `.gitattributes`

## Git Workflow

| Branch | Purpose |
|---|---|
| `master` | Protected production branch. PRs only, squash merge. |
| `dev` | Integration branch. Feature work merges here first. |
| `feat/*`, `fix/*`, `chore/*` | Short-lived branches off `dev` |

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
- **New convention or style rule** — add it to Code Style.
- **New workflow or branch policy change** — update Git Workflow.
- **Phase milestone reached or new phase defined** — update Roadmap Phases.
- **New provider added** — note it under Architecture or a dedicated Providers section if the list grows.

If a section becomes outdated or wrong, fix it immediately rather than leaving stale guidance. Accuracy matters more than completeness.

## Roadmap Phases

1. **Core MVP** — config, ask tool, spawn execution
2. **Sessions + streaming**
3. **Extended providers**
4. **Advanced features** — review, sandbox, npm publish
