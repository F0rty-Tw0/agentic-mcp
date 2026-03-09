# agentic-mcp

> Query Claude, Codex, Gemini, Copilot, and OpenCode from one interface.

[![CI](https://github.com/F0rty-Tw0/agentic-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/F0rty-Tw0/agentic-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Live-brightgreen.svg)](#status)

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

## AI Discoverability

Want agents to reliably find and use the right tools? See https://github.com/F0rty-Tw0/agentic-mcp/blob/master/MCP-SKILLS-DISCOVERABILITY.md for copy-paste prompts, skill instructions, and MCP/CLI discovery workflow.

Repository skill package: https://github.com/F0rty-Tw0/agentic-mcp/blob/master/skills/using-agentic-mcp/SKILL.md

### Paste This to Your AI Agent

```text
Set up agentic-mcp for me end-to-end.

Requirements:
1) If your environment supports skills, load the equivalent "using skills" guidance first (for example skills-using or /using-skills).
2) Run setup for Claude Code:
   npx agentic-mcp setup --client claude-code --yes
3) Verify installation by calling these MCP tools in order:
   - list_providers
   - ping_claude
   - help_claude
4) If setup fails, diagnose and fix, then rerun verification.
5) Report final status with what was configured and which providers are available.
6) Ask if any other providers should be set up too; if yes, configure and verify them the same way.
```

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

## CLI Usage

In addition to running as an MCP server, agentic-mcp can be invoked directly from the command line. Every CLI subcommand calls the matching MCP tool name through the same in-process MCP server contract, so CLI and MCP share argument names, error handling, and final results.

```bash
npx agentic-mcp <command> [options]
```

Or if installed globally:

```bash
agentic-mcp <command> [options]
```

### Commands

| Command                   | Description                                      |
| ------------------------- | ------------------------------------------------ |
| `ask_<provider> <prompt>` | Query a provider (e.g. `ask_claude "explain X"`) |
| `ask_all <prompt>`        | Query all providers in parallel                  |
| `ping_<provider>`         | Check if a provider is available                 |
| `help_<provider>`         | Show provider CLI help output                    |
| `sessions_<provider>`     | List known ask sessions for a provider           |
| `list_providers`          | List all configured providers                    |
| `provider_metrics`        | Show call statistics                             |

### Options

| Option                   | Description                                        |
| ------------------------ | -------------------------------------------------- |
| `--config <path>`        | Path to providers config file                      |
| `--model <name>`         | Model to use (ask commands)                        |
| `--working-dir <path>`   | Working directory for the provider                 |
| `--system-prompt <text>` | System prompt                                      |
| `--auto-mode <value>`    | Auto-mode flag value                               |
| `--effort <value>`       | Effort level                                       |
| `--max-budget <value>`   | Max budget                                         |
| `--context <text>`       | Additional prompt context                          |
| `--file <path>`          | File to include (repeatable)                       |
| `--stream-live`          | Stream live progress for `ask_<provider>` commands |
| `--providers <list>`     | Comma-separated provider list (`ask_all`)          |
| `--async`                | Run asynchronously                                 |
| `--job-id <id>`          | Job ID for async status checks                     |
| `--session-id <id>`      | Session ID for multi-turn                          |

### Examples

```bash
agentic-mcp ask_claude "what is TypeScript?"
agentic-mcp ask_claude "show progress" --stream-live
agentic-mcp ask_claude "summarize this" --context "Focus on risks"
agentic-mcp ask_claude "fix this bug" --async
agentic-mcp ask_claude --job-id job-123
agentic-mcp sessions_claude
agentic-mcp ask_codex "fix this bug" --model o4-mini
agentic-mcp ask_all "explain MCP" --providers claude,gemini
agentic-mcp list_providers
agentic-mcp ping_claude
```

CLI mode uses the same config resolution and MCP execution contract as server mode (see [Configuration](#configuration)).

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

Enable live streaming with `stream_live: true` in MCP `ask_*` tool calls or `--stream-live` in CLI `ask_<provider>` commands. Responses stream through MCP progress notifications in both modes.

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
├── cli/              # CLI router for direct command-line invocation
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
