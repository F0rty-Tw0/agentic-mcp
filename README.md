# agentic-mcp

> Prove and compare the AI CLIs you already installed, from one command surface or one MCP setup.

[![CI](https://github.com/F0rty-Tw0/agentic-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/F0rty-Tw0/agentic-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

`agentic-mcp` helps you prove an installed provider CLI can do real work, compare multiple installed providers on the same prompt, and reuse one workflow across terminal and MCP clients.

## Who this is for

- Terminal-first developers who already have at least one provider CLI installed
- Developers who want to compare two installed providers on the same prompt
- MCP client users who want one reusable setup path for Claude Code, Cursor, or Windsurf
- Tool and agent builders who want a consistent ask, ping, and comparison surface across installed CLIs

## Who should skip it

- Users who only need one provider and are happy with that provider's native CLI
- Users looking for hosted routing, hosted billing, or a cloud model marketplace
- Users who do not yet have any provider CLI installed or authenticated

## Why this exists

- Installed AI CLIs expose different proof paths, flags, and workflows
- Comparing providers by hand means rerunning the same prompt and collecting outputs yourself
- MCP client setup becomes repetitive when each tool wants its own integration entry
- `agentic-mcp` keeps proof, comparison, and reusable setup in one workflow

## Choose your path in 30 seconds

- **I already installed one provider and I want proof it can answer real work from the terminal.**
  Start here: [Get your first real answer from the terminal](./docs/getting-started/terminal-first-success.md)

- **I already installed two providers and I want to compare which one gives the better answer.**
  Start here: [Compare two providers on the same prompt](./docs/getting-started/compare-two-providers.md)

- **I already use Claude Code and I want the same proof-and-compare workflow there without wiring each provider separately.**
  Start here: [Reuse one Claude Code setup across my installed providers](./docs/getting-started/claude-code-multi-provider.md)

MCP is how editor and agent clients reach the same workflow. It is the delivery mechanism, not the reason to use the project.

## Concrete scenarios

- "I installed Claude and want to know whether it is actually authenticated before I wire it into anything else."
- "I installed Claude and Codex and want to compare their refactor suggestions on the same prompt."
- "I already work in Claude Code and want one reusable setup instead of separate per-provider MCP entries."

## When to use something else

- Use a provider's native CLI when one provider is enough and you do not need comparison or MCP reuse
- Use `llm` when you want a broad plugin-centric CLI for local and remote models
- Use OpenRouter when you want hosted multi-model routing behind one API
- Use `agentic-mcp` when you already work through installed provider CLIs and want proof, comparison, and one reusable workflow

## How it works

1. You install and authenticate one or more provider CLIs locally.
2. `agentic-mcp` helps you prove one works for a real task and compare several on the same prompt.
3. If you want editor or agent integration, you reuse that same workflow through an MCP client.

## Before you start

You need:

- Node.js 22 or newer
- At least one supported provider CLI installed locally and already authenticated
- An MCP client only if you want editor or agent integration; direct CLI usage works without one

Supported provider binaries today:

- Core enabled providers: `claude`, `codex`, `copilot`, `gemini`, `opencode`
- Additional enabled providers: `aider`, `goose`, `amp`, `cline`, `agent` (Cursor Agent CLI), `droid`
- Disabled templates shipped for later verification: `q` (Amazon Q), `plandex`, `openhands`, `qwen`, `tabnine`

`list_providers` is the source of truth for what is enabled, what is disabled, which support level each provider is in, and which prerequisites a template still needs. If the underlying binary is missing or not logged in, setup may still succeed while provider calls fail.

## Quickstart

### 1. Run minimal onboarding

```bash
npx agentic-mcp init
```

`init` is a safe onboarding alias for `setup --minimal`. It installs the bundled `using-agentic-mcp` skill, detects provider binaries, and tells you what is still unproven.

What this step proves:

- `agentic-mcp` is installed and can run locally
- the bundled skill is available for agent workflows
- which provider binaries are detected on this machine

What this step does not prove:

- MCP client config is written
- provider authentication works
- a real prompt can complete through a provider

### 2. Discover what is detected

```bash
npx agentic-mcp list_providers
```

What this step proves:

- which providers are `binary detected`, `binary missing`, or `disabled`
- which support level each configured provider reports
- which prerequisites a disabled template still expects
- which provider should be your first real-answer candidate

What this step does not prove:

- provider authentication works
- a real prompt can complete through that provider

### 3. Get your first real answer

```bash
npx agentic-mcp prove
```

Use `npx agentic-mcp prove codex` if you want to force a specific detected provider.

What this step proves:

- `agentic-mcp` can pick a detected provider and route a real prompt through it
- your installed provider is usable for real work through this project

Milestone: You have now successfully routed a real provider through `agentic-mcp`.

### 4. Compare providers when two are usable

```bash
npx agentic-mcp ask_all "Reply with one sentence on why your answer is useful here." --providers claude,codex
```

Use this only when you want side-by-side comparison on the same prompt.

What this step proves:

- you can compare providers through one interface instead of hand-running the same prompt multiple times
- `ask_all` is the product's comparison workflow, not just an advanced extra

Milestone: You have now completed your first side-by-side provider comparison through `agentic-mcp`.

### 5. Optional: run a limited ping check

```bash
npx agentic-mcp ping_claude
```

Replace `claude` with the provider you actually installed.

What this step proves:

- the selected provider binary was detected
- the version check works if that provider exposes one

What this step does not prove:

- provider authentication works
- a real provider answer can complete

### 6. Add MCP client setup when you want editor or agent integration

If you want MCP tools inside Claude Code, Cursor, or Windsurf, write the client config entry now:

```bash
npx agentic-mcp setup --client claude-code --yes
npx agentic-mcp setup --client cursor --yes
npx agentic-mcp setup --client windsurf --yes
```

For another MCP client, generate a generic JSON entry and choose the target file yourself:

```bash
npx agentic-mcp setup --client generic --path /path/to/mcp.json --yes
```

If you want to preview changes before writing, add `--dry-run`. If you only care about terminal usage, you can stop after the proof steps above.

What this step proves:

- `agentic-mcp` can write or preview the MCP client entry
- the setup output tells you what was configured, what was detected, and what remains unproven

What this step does not prove:

- provider authentication works
- a real provider response can complete through `agentic-mcp`

If you are using MCP mode, restart your client after setup and confirm that tools such as `list_providers`, `ping_<provider>`, `ask_<provider>`, and `review_<provider>` where supported appear.

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
npx agentic-mcp prove
npx agentic-mcp ask_claude "What changed in TypeScript 5.9?"
npx agentic-mcp ask_codex "Suggest a refactor for this function"
npx agentic-mcp sessions_claude
```

When run without a subcommand, `agentic-mcp` starts as an MCP stdio server.

### Review repository changes with a provider

> Today this is primarily useful with `review_codex`, because Codex is the first shipped provider with a review command.

```bash
npx agentic-mcp review_codex --scope uncommitted --working-dir .
```

Review flags:

| Flag                            | Meaning                                            | When to use it                                                               |
| ------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `--scope uncommitted`           | Review staged, unstaged, and untracked changes     | Fast pass on your current working tree                                       |
| `--scope commit --commit <sha>` | Review one commit                                  | Focus on a single change set                                                 |
| `--scope range --base <ref>`    | Review everything relative to a base branch or ref | Review a feature branch against main                                         |
| `--working-dir <path>`          | Run the review in a specific repository root       | Required when your current shell directory is not the repo you want reviewed |
| `--model <name>`                | Pass a provider-specific model hint                | Override the provider default when needed                                    |
| `--stream-live`                 | Show live review progress in the terminal          | Useful for longer reviews so the command does not look idle                  |

Examples:

```bash
npx agentic-mcp review_codex --scope uncommitted --working-dir .
npx agentic-mcp review_codex --scope commit --commit HEAD~1 --working-dir .
npx agentic-mcp review_codex --scope range --base origin/main --working-dir . --model gpt-5
```

The review command is routed through the same MCP tool surface as `ask_<provider>`, so editor clients can expose `review_<provider>` when that provider declares a review command.

### Compare providers on the same prompt

```bash
npx agentic-mcp ask_all "Summarize this API design" --providers claude,codex,gemini
npx agentic-mcp ask_all "Compare providers" --providers gemini codex
npx agentic-mcp ask_all "Use one shared model" --providers claude,gemini --model claude-sonnet-4
```

Use this when you want side-by-side answers without hand-running the same prompt several times.

#### ask_all flag semantics

| Flag          | Meaning                                       | Accepted forms                                         | Notes                                                        |
| ------------- | --------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| `--provider`  | Provider selector alias                       | `--provider gemini`, `--provider gemini codex`         | Normalized to `--providers`                                  |
| `--providers` | Explicit provider selection                   | `--providers gemini,codex`, `--providers gemini codex` | Comma-separated and space-separated values are both accepted |
| `--model`     | Shared model hint for every selected provider | `--model claude-sonnet-4`                              | Pass exactly one shared model value                          |
| `--models`    | Shared model hint alias                       | `--models claude-sonnet-4`                             | Normalized to `--model` before parsing                       |

#### ask_all flag combinations

- `--providers` or `--provider` decides which providers run.
- `--model` or `--models` decides which shared model hint is passed to those selected providers.
- `--model` takes exactly one shared model value. Use `--providers` for provider selection.
- If you combine `--providers` with `--model`, provider selection comes from `--providers` and the shared model comes from `--model`. Example: `--providers claude,gemini --model claude-sonnet-4`.
- If a selected provider rejects the shared model as unavailable or unsupported, `ask_all` returns that provider error directly instead of falling back to a different model.
- Unknown ask_all flags still fail fast with a validation error.

### Check what is detected on this machine

```bash
npx agentic-mcp list_providers
npx agentic-mcp ping_claude
npx agentic-mcp help_claude
npx agentic-mcp provider_metrics
```

`provider_metrics` is the after-action view: it tells you which providers you actually used, how often they succeeded, and how long they took.

## Built-in provider support

These provider definitions ship with the project. Whether they are actually usable on your machine still depends on the underlying CLI binary being installed and authenticated.

| Provider  | Binary      | Support level | Enabled by default | Notes                                |
| --------- | ----------- | ------------- | ------------------ | ------------------------------------ |
| Claude    | `claude`    | stable        | Yes                | ask, sessions                        |
| Codex     | `codex`     | stable        | Yes                | ask, review, sessions                |
| Copilot   | `copilot`   | stable        | Yes                | ask, sessions                        |
| Gemini    | `gemini`    | stable        | Yes                | ask                                  |
| OpenCode  | `opencode`  | stable        | Yes                | ask, sessions, model listing         |
| Aider     | `aider`     | community     | Yes                | ask                                  |
| Goose     | `goose`     | beta          | Yes                | ask, sessions                        |
| Amp       | `amp`       | beta          | Yes                | ask                                  |
| Cline     | `cline`     | beta          | Yes                | ask                                  |
| Cursor    | `agent`     | beta          | Yes                | ask                                  |
| Droid     | `droid`     | beta          | Yes                | ask                                  |
| Amazon Q  | `q`         | experimental  | No                 | disabled template with prerequisites |
| Plandex   | `plandex`   | community     | No                 | disabled template with prerequisites |
| OpenHands | `openhands` | experimental  | No                 | disabled template with prerequisites |
| Qwen Code | `qwen`      | experimental  | No                 | disabled template with prerequisites |
| Tabnine   | `tabnine`   | experimental  | No                 | disabled template with prerequisites |

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

| Command                   | What it does                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `ask_<provider> <prompt>` | Query one provider                                                                       |
| `review_<provider>`       | Run repository review where that provider declares a review command                      |
| `ask_all <prompt>`        | Query several providers in parallel                                                      |
| `ping_<provider>`         | Check limited provider proof                                                             |
| `help_<provider>`         | Show the provider CLI help output                                                        |
| `sessions_<provider>`     | List known sessions for that provider                                                    |
| `list_providers`          | Show configured providers with detected status, support levels, and prerequisites        |
| `provider_metrics`        | Show which providers you actually used, how often they succeeded, and how long they took |
| `prove [provider]`        | Run one canned real-answer proof against a detected provider                             |
| `setup`                   | Configure an MCP client                                                                  |

Run `npx agentic-mcp --help` for the full CLI reference.

## AI agent setup guides

If you want another AI agent to discover and use this project reliably:

- Read the agent workflow guide: [MCP-SKILLS-DISCOVERABILITY.md](./MCP-SKILLS-DISCOVERABILITY.md)
- Use the bundled skill: [skills/using-agentic-mcp/SKILL.md](./skills/using-agentic-mcp/SKILL.md)
- Start from a goal-based path: [docs/getting-started](./docs/getting-started)

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
