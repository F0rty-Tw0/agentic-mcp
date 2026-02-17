# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**agentic-mcp** is a config-driven [MCP](https://modelcontextprotocol.io/) server that wraps any agentic CLI tool. Adding a new CLI provider means adding an entry to `providers.json` — no code changes, no rebuilds.

Status: in early development (pre-source). Build tooling and source files are being established.

## Commands

```bash
pnpm install        # install dependencies
pnpm build          # compile TypeScript
pnpm test           # run tests
pnpm lint           # lint (expected once CI is configured)
```

## Architecture (planned)

The labeler config and contributing guide reveal the intended source layout:

```
providers.json          # provider definitions — the only file to touch when adding a CLI
src/
  server.ts             # MCP server entrypoint
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

## Code Style

- TypeScript strict mode
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
