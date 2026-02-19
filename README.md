# agentic-mcp

> Config-driven MCP server that wraps any agentic CLI tool.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-In%20Development-orange.svg)](#status)

**agentic-mcp** is a universal [MCP](https://modelcontextprotocol.io/) server that wraps any agentic CLI tool through a single JSON config. Adding a new CLI means adding a config entry — no code changes, no rebuilds.

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

| Provider | CLI        | Default Model               | Output |
| -------- | ---------- | --------------------------- | ------ |
| claude   | `claude`   | claude-opus-4-6             | json   |
| codex    | `codex`    | gpt-5.3-codex               | json   |
| copilot  | `copilot`  | gpt-5                       | text   |
| gemini   | `gemini`   | gemini-2.5-pro              | json   |
| opencode | `opencode` | anthropic/claude-sonnet-4-5 | json   |

Providers are auto-detected at startup — if a CLI binary isn't found in PATH, the provider is marked unavailable but doesn't prevent the server from starting.

## Quick Start

```bash
# Prerequisites: Node.js >= 22, pnpm
pnpm install

# Run in dev mode
pnpm run dev

# Or build and run
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
    "defaultModel": "default-v1",
    "timeout": 120000,
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
