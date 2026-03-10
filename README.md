# agentic-mcp

> One MCP server and CLI wrapper for local AI agent CLIs.

[![CI](https://github.com/F0rty-Tw0/agentic-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/F0rty-Tw0/agentic-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

`agentic-mcp` gives you one integration surface for multiple local AI CLIs such as Claude, Codex, Copilot, Gemini, and OpenCode.

Use it in two ways:

- As an MCP server for clients like Claude Code, Cursor, and Windsurf
- As a direct CLI for asking providers, checking availability, and comparing responses

The point is simple: set up provider CLIs once, then use a consistent command and tool surface instead of wiring each provider separately.

## Why people use it

- One command surface across multiple AI CLIs
- One MCP server entry instead of per-provider client wiring
- Direct CLI and MCP mode share the same provider definitions and behavior
- New providers can be added declaratively in config instead of writing provider-specific code

## How it works

1. You install and authenticate one or more provider CLIs locally.
2. `agentic-mcp` exposes a uniform MCP and CLI interface on top of them.
3. Your MCP client or terminal calls `agentic-mcp`, which invokes the underlying provider CLI with the right arguments.

## Before you start

You need:

- Node.js 22 or newer
- At least one supported provider CLI installed locally and already authenticated
- An MCP client only if you want editor or agent integration; direct CLI usage works without one

Supported provider binaries:

- `claude`
- `codex`
- `copilot`
- `gemini`
- `opencode`

If those binaries are missing or not logged in, setup may succeed but provider calls will still fail. That is the most common source of confusion on first run.

## Quickstart

### 1. Run minimal onboarding

```bash
npx agentic-mcp init
```

`init` is a safe onboarding alias for `setup --minimal`.

It does two things:

- installs the bundled `using-agentic-mcp` skill
- prints the next client-specific setup command

It does not write MCP client configuration yet.

### 2. Configure your MCP client

Pick the client you actually use:

```bash
npx agentic-mcp setup --client claude-code --yes
npx agentic-mcp setup --client cursor --yes
npx agentic-mcp setup --client windsurf --yes
```

For another MCP client, generate a generic JSON entry and choose the target file yourself:

```bash
npx agentic-mcp setup --client generic --path /path/to/mcp.json --yes
```

If you want to preview changes before writing, add `--dry-run`.

### 3. Verify that your providers are usable

```bash
npx agentic-mcp list_providers
npx agentic-mcp ping_claude
```

Replace `claude` with the provider you actually installed.

A healthy setup should show your providers in `list_providers` and report `available` for `ping_<provider>`.

### 4. Try a real command

```bash
npx agentic-mcp ask_claude "Explain MCP in one paragraph"
```

If you are using MCP mode, restart your client after setup and confirm that tools such as `list_providers`, `ping_<provider>`, and `ask_<provider>` appear.

## Supported MCP clients

| Client       | Setup command                                                           | Default config path                    |
| ------------ | ----------------------------------------------------------------------- | -------------------------------------- |
| Claude Code  | `npx agentic-mcp setup --client claude-code --yes`                      | `~/.claude/claude_desktop_config.json` |
| Cursor       | `npx agentic-mcp setup --client cursor --yes`                           | `~/.cursor/mcp.json`                   |
| Windsurf     | `npx agentic-mcp setup --client windsurf --yes`                         | `~/.codeium/windsurf/mcp_config.json`  |
| Generic JSON | `npx agentic-mcp setup --client generic --path /path/to/mcp.json --yes` | user-supplied                          |

Setup uses merge mode by default, preserves existing MCP servers, creates backups when appropriate, and verifies writes after updating the file.

For Claude tooling, the setup target name is `claude-code`, but the config file it updates is `~/.claude/claude_desktop_config.json`. That filename comes from the client-side config convention, not from this package.

## Common workflows

### Use it as a direct CLI

You do not need an MCP client to use `agentic-mcp`.

```bash
npx agentic-mcp ask_claude "What changed in TypeScript 5.9?"
npx agentic-mcp ask_codex "Suggest a refactor for this function"
npx agentic-mcp sessions_claude
```

When run without a subcommand, `agentic-mcp` starts as an MCP stdio server.

### Compare providers on the same prompt

```bash
npx agentic-mcp ask_all "Summarize this API design" --providers claude,codex,gemini
```

Use this when you want side-by-side answers without hand-running the same prompt several times.

### Check what is available on this machine

```bash
npx agentic-mcp list_providers
npx agentic-mcp ping_claude
npx agentic-mcp help_claude
npx agentic-mcp provider_metrics
```

## Built-in provider support

These provider definitions ship with the project. Whether they are actually usable on your machine still depends on the underlying CLI binary being installed and authenticated.

| Provider | Binary     | Included by default |
| -------- | ---------- | ------------------- |
| Claude   | `claude`   | Yes                 |
| Codex    | `codex`    | Yes                 |
| Copilot  | `copilot`  | Yes                 |
| Gemini   | `gemini`   | Yes                 |
| OpenCode | `opencode` | Yes                 |

Provider definitions live in `src/config/providers.json`.

## Useful setup flags

`agentic-mcp setup` supports a few flags that matter often:

- `--minimal` - install the skill and print suggested next steps without writing client config
- `--dry-run` - preview the planned change without writing files
- `--yes` - allow non-interactive writes
- `--mode merge|overwrite` - choose how an existing config file is updated
- `--path <file>` - target a specific config file
- `--backup if-exists|always|never` - control backup behavior
- `--output json` - machine-readable setup output

## Command overview

```bash
npx agentic-mcp <command> [options]
```

Core commands:

| Command                   | What it does                               |
| ------------------------- | ------------------------------------------ |
| `ask_<provider> <prompt>` | Query one provider                         |
| `ask_all <prompt>`        | Query several providers in parallel        |
| `ping_<provider>`         | Check whether a provider is available      |
| `help_<provider>`         | Show the provider CLI help output          |
| `sessions_<provider>`     | List known sessions for that provider      |
| `list_providers`          | Show configured providers and availability |
| `provider_metrics`        | Show provider usage stats                  |
| `setup`                   | Configure an MCP client                    |

Run `npx agentic-mcp --help` for the full CLI reference.

## AI agent setup and discoverability

If you want another AI agent to discover and use this project reliably:

- Read the discoverability guide: [MCP-SKILLS-DISCOVERABILITY.md](./MCP-SKILLS-DISCOVERABILITY.md)
- Use the bundled skill: [skills/using-agentic-mcp/SKILL.md](./skills/using-agentic-mcp/SKILL.md)

That material is useful once the basic setup above works. It is not required for a normal first run.

## Development

```bash
pnpm install
pnpm run dev
pnpm run build
pnpm run test
pnpm run typecheck
pnpm run lint
```

If you want to inspect the MCP server manually:

```bash
pnpm run inspect
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
