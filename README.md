# agentic-mcp

> Config-driven MCP server that wraps any agentic CLI tool.

[![CI](https://github.com/F0rty-Tw0/agentic-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/F0rty-Tw0/agentic-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-In%20Development-orange.svg)](#status)

**agentic-mcp** is a universal [MCP](https://modelcontextprotocol.io/) server that wraps any agentic CLI tool through a single JSON config. Adding a new CLI means adding a config entry — no code changes, no rebuilds.

> **Requires Node.js >= 22**

## Status

Core MVP is functional — config loading, tool registration, spawn execution, and the ask/ping/help/list_providers tools work end-to-end. Five providers configured: claude, codex, copilot, gemini, opencode.

## How It Works

agentic-mcp sits between your MCP client (Claude Code, Cursor, etc.) and any number of CLI coding agents. It reads a single `providers.json` config file and dynamically registers MCP tools for each provider:

```
MCP Client  <──stdio──>  agentic-mcp  <──spawn──>  claude, codex, copilot, gemini, opencode
```

For each enabled provider, three tools are registered:

| Tool     | Pattern           | Purpose                                   |
| -------- | ----------------- | ----------------------------------------- |
| **ask**  | `ask_{provider}`  | Send a prompt to the provider's CLI       |
| **ping** | `ping_{provider}` | Check if the provider binary is reachable |
| **help** | `help_{provider}` | Show the provider's CLI help text         |

Plus one meta tool: `list_providers` — returns all configured providers with their availability status.

## Providers

Five providers ship out of the box:

| Provider | CLI        | Output |
| -------- | ---------- | ------ |
| claude   | `claude`   | json   |
| codex    | `codex`    | json   |
| copilot  | `copilot`  | text   |
| gemini   | `gemini`   | json   |
| opencode | `opencode` | json   |

When `model` is omitted from an `ask_{provider}` call, agentic-mcp passes no model flag and the provider CLI uses its own default model selection.

Providers are auto-detected at startup — if a CLI binary isn't found in PATH, the provider is marked unavailable but doesn't prevent the server from starting.

## Quick Start

### npm (global install)

```bash
npm install -g agentic-mcp
agentic-mcp
```

### npx (no install)

```bash
npx agentic-mcp
```

### From source

```bash
git clone https://github.com/F0rty-Tw0/agentic-mcp.git
cd agentic-mcp
pnpm install
pnpm run build
pnpm run start
```

### MCP Client Configuration

Add to your MCP client config (e.g. `~/.claude.json`):

```json
{
  "mcpServers": {
    "agentic-mcp": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/agentic-mcp"
    }
  }
}
```

### Custom Config Path

```bash
# Via CLI flag
node dist/index.js --config /path/to/providers.json

# Via environment variable
AGENTIC_MCP_CONFIG=/path/to/providers.json node dist/index.js
```

Config resolution order: `--config` flag > `AGENTIC_MCP_CONFIG` env > user-local config (`~/.config/agentic-mcp/providers.json` or `%APPDATA%/agentic-mcp/providers.json`) > bundled default.

## Adding a Provider

Edit `src/config/providers.json` (or your user-local copy):

```jsonc
{
  "myagent": {
    "enabled": true,
    "description": "My custom agent",
    "command": "myagent",
    "timeout": 600000,
    "env": {},
    "outputFormat": "json",
    "commands": {
      "ask": {
        "args": ["run"],
        "trailingArgs": ["--json"],
        "flags": {
          "model": "-m",
          "autoMode": ["--auto"],
          "sandbox": {
            "flag": "--sandbox",
            "values": ["safe", "unsafe"],
          },
        },
      },
    },
    "input": { "method": "positional" },
  },
}
```

Then validate: `pnpm run validate:providers`

## Scripts

```bash
pnpm run build              # Bundle with esbuild (dist/index.js + providers.json)
pnpm run dev                # Dev mode (node --experimental-strip-types)
pnpm run start              # Run compiled server
pnpm run test               # Unit tests (vitest)
pnpm run test:integration   # Integration tests (vitest, separate config)
pnpm run validate:providers # Validate providers.json against Zod schema
pnpm run typecheck          # Type-check (tsc --noEmit)
pnpm run lint               # ESLint
pnpm run lint:fix           # ESLint + auto-fix
```

## Security

- CLI binaries are resolved and pinned at startup (absolute paths)
- Child processes use `spawn()` with array args — never `shell: true`
- Child environments are isolated (minimal base env, not full `process.env`)
- Output is size-limited (10 MB) to prevent memory exhaustion
- All inputs validated with Zod at call time
- Dangerous auto-mode flags trigger startup warnings

## License

[MIT](LICENSE)
