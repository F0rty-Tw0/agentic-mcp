# CLAUDE.md

## Gotchas

- **`pnpm run`** — always `pnpm run <script>`, never bare `pnpm <script>`.
- **`.ts` import extensions** — all relative imports use `.ts` (`'./foo.ts'`), never `.js`. Package imports keep their original extension (`'@modelcontextprotocol/sdk/server/mcp.js'`).
- **Config over code** — new providers go in `providers.json`, not in source files. No code changes, no rebuilds.
- **Never `shell: true`** — all spawns use `cross-spawn` with array args. Never pass user input through a shell.

## Git

- **PRs target `dev`**, not `master`. Flow: `feat/x` -> PR -> `dev` -> PR -> `master`.
- **Commit format:** `type(scope): emoji message` — e.g. `feat(config): ✨ add Zod schema for providers`.
- **Squash merge only.** Auto-delete branches after merge. Apply labels from `.github/labels.yml`.

## Code Style

See [`AGENTS.md`](./AGENTS.md) for coding conventions, testing rules, and TDD enforcement.
