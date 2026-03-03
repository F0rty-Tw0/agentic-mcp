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

- `provider_metrics` — View session statistics (call counts, response times, success rates)

### Explore

- `list_providers` — See which AI models are available
- `ping_*` — Check if a provider is ready
- `help_*` — See what a provider can do

### Manage sessions

Track multi-turn conversations with providers that support it:

- `sessions_*` — List known ask sessions for a provider

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
<summary>CLI Argument Builder</summary>

The `cli-args` module translates abstract MCP tool arguments into the concrete `string[]` needed to spawn each provider's CLI process. It uses the provider's declarative config to determine argument ordering, prompt delivery, and flag resolution — no per-provider code required.

**Argument ordering:**

```
[command args] → [prompt] → [optional flags] → [trailing args]
```

**Prompt delivery** is determined by `config.input.method`:

| Method       | Behavior                                   |
| ------------ | ------------------------------------------ |
| `positional` | Prompt appended as a positional argument   |
| `flag`       | Prompt follows the flag prefix from `args` |
| `stdin`      | Prompt sent via stdin, not in args         |

**Flag types** in `providers.json`:

| Shape         | Example config                                         | Output                       |
| ------------- | ------------------------------------------------------ | ---------------------------- |
| `string`      | `"--model"`                                            | `["--model", "gpt-4"]`       |
| `string[]`    | `["--full-auto"]`                                      | `["--full-auto"]`            |
| `LeveledFlag` | `{ flag: "--sandbox", values: ["read-only", "full"] }` | `["--sandbox", "read-only"]` |

Supported optional flags: `model`, `working_directory`, `files`, `auto_mode`, `sandbox`, `effort`, `max_budget`, `system_prompt`. Flags missing from the provider config are silently skipped.

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

<details>
<summary>Project Structure</summary>

```
src/
├── ask/              # Per-provider ask handler (command, execution, response, sessions)
├── ask-all/          # Fan-out queries to all providers in parallel
├── background-jobs/  # Async job queue for long-running asks
├── cli-args/         # Declarative config → CLI argument builder
├── config/           # Provider config loader (multi-source resolution)
├── entry/            # CLI entry point (--version, --help, setup, server)
├── provider-metrics/ # Per-provider call counts, timing, success rates
├── server/           # MCP server factory
├── session/          # Session store with locking for multi-turn conversations
├── setup/            # `agentic-mcp setup` CLI for configuring MCP clients
├── shared/           # Cross-cutting concerns
│   ├── command-execution/  # Process spawning, semaphore, output collection
│   ├── mcp-protocol/       # MCP types, heartbeat, error formatting
│   ├── provider/           # Provider config types, env resolver, model errors
│   └── validation/         # Request registry, Zod utilities
├── simple-tools/     # ping, help, list_providers handlers
├── streaming/        # Live output via MCP progress notifications
├── tool-registry/    # MCP tool registration from provider config
└── types/            # Ambient TypeScript declarations
```

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
