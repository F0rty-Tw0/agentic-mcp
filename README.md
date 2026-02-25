# agentic-mcp

> Query Claude, Codex, Gemini, Copilot, and OpenCode from one interface.

[![CI](https://github.com/F0rty-Tw0/agentic-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/F0rty-Tw0/agentic-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-In%20Development-orange.svg)](#status)

Multi-model AI gateway that wraps any agentic CLI tool as an [MCP](https://modelcontextprotocol.io/) server. Add a new AI provider by editing a JSON file — no code changes, no rebuilds.

> **Requires Node.js >= 22**

## 30-Second Setup

```bash
npx agentic-mcp setup --client claude-code
```

Or install globally:

```bash
npm install -g agentic-mcp
agentic-mcp setup --client claude-code
```

Supported clients: Claude Code, Cursor, Windsurf, or any MCP-compatible tool.

### Safe Setup Defaults

`agentic-mcp setup` is now safe by default:

- Default mode is merge (`--mode merge`)
- Existing configs are preserved and only `mcpServers["agentic-mcp"]` is updated
- Writes use backup + atomic replace + read-back verification
- Non-interactive writes require `--yes`

Common flags:

- `--dry-run` — show plan without writing
- `--output json` — machine-readable result
- `--mode merge|overwrite` — choose update strategy (`overwrite` is explicit/destructive)
- `--path <file>` — target a specific config file
- `--backup if-exists|always|never` — backup policy before writes

## What Can You Do?

### Get an answer

Ask any provider directly:

- `ask_claude` — Get an answer from Claude
- `ask_codex` — Get an answer from Codex
- `ask_gemini` — Get an answer from Gemini
- `ask_copilot` — Get an answer from Copilot
- `ask_opencode` — Get an answer from OpenCode

### Compare providers

Send the same prompt to multiple providers simultaneously:

- `ask_all` — Query all available providers at once and compare responses side-by-side

### Track your usage

See per-provider call counts, response times, and success rates:

- `usage_summary` — View session statistics

### Explore

- `list_providers` — See which AI models are available
- `ping_*` — Check if a provider is ready
- `help_*` — See what a provider can do

## Providers

| Provider | CLI Tool   | Status        |
| -------- | ---------- | ------------- |
| Claude   | `claude`   | ✅ Configured |
| Codex    | `codex`    | ✅ Configured |
| Copilot  | `copilot`  | ✅ Configured |
| Gemini   | `gemini`   | ✅ Configured |
| OpenCode | `opencode` | ✅ Configured |

Adding a new provider? Just edit `providers.json` — no code changes needed.

<details>
<summary>Configuration</summary>

### Config Sources (highest priority first)

1. `--config` CLI flag
2. `AGENTIC_MCP_CONFIG` environment variable
3. `~/.config/agentic-mcp/providers.json` (user-local)
4. Bundled `providers.json` (default)

### Provider Config Structure

Each provider is defined in `providers.json` with:

- CLI binary name and resolution
- Command definitions (ask, ping, help)
- Flag mappings for model selection, context, files, etc.
- Output format (`json`, `stream-json`, or `text`)

See `providers.json` for examples.

</details>

<details>
<summary>Advanced Features</summary>

### Streaming

Enable live streaming with `stream_live: true` in ask tool calls. Responses stream via MCP progress notifications.

### Async Mode

For long-running queries, use `mode: "async"` to get a job ID, then poll with `action: "status"`.

### Sessions

Some providers support persistent sessions via `session_id` for multi-turn conversations.

</details>

<details>
<summary>Security Model</summary>

- All CLI commands use `spawn()` with array args — no shell injection
- Child process environments are isolated (minimal base env)
- Binary paths resolved and pinned at startup
- Output size-limited to prevent memory exhaustion
- Zod validation on all inputs

</details>

<details>
<summary>Adding a Provider</summary>

1. Add an entry to `providers.json`
2. Restart the server

That's it. No code changes needed. See existing entries for the config shape.

</details>

## Development

```bash
pnpm install          # install dependencies
pnpm run dev          # run in dev mode
pnpm run build        # build for production
pnpm run test         # run tests
pnpm run typecheck    # type-check
pnpm run lint         # lint
```

## License

MIT
