# agentic-mcp

> Prove and compare the AI CLIs you already installed, from one command surface or one MCP setup.

[![CI](https://github.com/F0rty-Tw0/agentic-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/F0rty-Tw0/agentic-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

`agentic-mcp` helps you prove an installed provider CLI can do real work, compare multiple installed providers on the same prompt, and reuse one workflow across terminal and MCP clients.

## Who this is for

- Terminal-first developers who already have at least one provider CLI installed
- Developers who want to compare two installed providers on the same prompt
- MCP client users who want one reusable setup path for Claude Code, Codex CLI, Copilot CLI, Gemini CLI, Antigravity, OpenCode, Cursor, or Windsurf
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
- Use `mcpc` when your main goal is configure-once MCP portability and you do not need installed-CLI proof or side-by-side comparison
- Use `agentic-mcp` when you already work through installed provider CLIs and want proof, comparison, and one reusable workflow

## How it works

1. You install and authenticate one or more provider CLIs locally.
2. `agentic-mcp` helps you prove one works for a real task and compare several on the same prompt.
3. If you want editor or agent integration, you reuse that same workflow through an MCP client.

## Before you start

You need:

- Node.js 26 or newer
- At least one supported provider CLI installed locally and already authenticated
- An MCP client only if you want editor or agent integration; direct CLI usage works without one

Supported provider binaries today:

- Core enabled providers: `claude`, `codex`, `copilot`, `gemini`, `opencode`
- Additional enabled providers: `agy` (Antigravity CLI), `aider`, `goose`, `amp`, `cline`, `agent` (Cursor Agent CLI), `droid`
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
npx agentic-mcp ask_all "Reply with one sentence on why your answer is useful here." --providers claude,codex --report ./reports/first-comparison.json
```

Use this only when you want side-by-side comparison on the same prompt. Add `--report <path>` when you want to keep the structured comparison as a reusable JSON artifact.

What this step proves:

- you can compare providers through one interface instead of hand-running the same prompt multiple times
- `ask_all` is the product's comparison workflow, not just an advanced extra
- the comparison can be saved and reused outside the terminal

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

If you want MCP tools inside Claude Code, Codex CLI, Copilot CLI, Gemini CLI, Antigravity, OpenCode, Cursor, or Windsurf, write the client config entry now:

```bash
npx agentic-mcp setup --client claude-code --yes
npx agentic-mcp setup --client codex --yes
npx agentic-mcp setup --client copilot --yes
npx agentic-mcp setup --client gemini --yes
npx agentic-mcp setup --client antigravity --yes
npx agentic-mcp setup --client opencode --yes
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

| Client       | Setup command                                                           | Default config path                   |
| ------------ | ----------------------------------------------------------------------- | ------------------------------------- |
| Claude Code  | `npx agentic-mcp setup --client claude-code --yes`                      | `~/.claude.json`                      |
| Codex CLI    | `npx agentic-mcp setup --client codex --yes`                            | `~/.codex/config.toml`                |
| Copilot CLI  | `npx agentic-mcp setup --client copilot --yes`                          | `~/.copilot/mcp-config.json`          |
| Gemini CLI   | `npx agentic-mcp setup --client gemini --yes`                           | `~/.gemini/settings.json`             |
| Antigravity  | `npx agentic-mcp setup --client antigravity --yes`                      | `~/.gemini/config/mcp_config.json`    |
| OpenCode     | `npx agentic-mcp setup --client opencode --yes`                         | `~/.config/opencode/opencode.json`    |
| Cursor       | `npx agentic-mcp setup --client cursor --yes`                           | `~/.cursor/mcp.json`                  |
| Windsurf     | `npx agentic-mcp setup --client windsurf --yes`                         | `~/.codeium/windsurf/mcp_config.json` |
| Generic JSON | `npx agentic-mcp setup --client generic --path /path/to/mcp.json --yes` | user-supplied                         |

Setup uses merge mode by default, preserves existing MCP servers and every other key, creates backups when appropriate, and verifies writes after updating the file. Inside the `agentic-mcp` entry it sets the command, keeps keys it does not write (such as `env`), and writes the client's tool-call timeout (see [Long-running calls](#long-running-calls)). If the existing file is not strict JSON (comments, trailing commas), or for Codex not valid TOML, merge mode leaves it unchanged and warns you to add the entry by hand. It does the same when your `agentic-mcp` entry points at a remote server (`url`, `httpUrl` or `serverUrl`), since adding a `command` would mix two transports, or when Codex's `mcp_servers` is not a table.

The paths above are the defaults. If you moved a client's config with `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `COPILOT_HOME`, `GEMINI_CLI_HOME`, `XDG_CONFIG_HOME`, `OPENCODE_CONFIG` or a project-level file, pass that file with `--path`. Without `--path`, setup warns when one of these variables points the client at another file, and names that file. OpenCode also reads `opencode.jsonc`; setup writes `opencode.json` only. The agy changelog documents no variable that moves Antigravity's `mcp_config.json`, so setup gives no such warning for it.

For Claude Code, setup adds the server to the user-scope `mcpServers` in `~/.claude.json`, the same place `claude mcp add --scope user` writes. Check it with `claude mcp get agentic-mcp`.

## Long-running calls

A big PR review or a multi-file task can run for many minutes. Two sets of limits apply: the ones in `agentic-mcp`, and your MCP client's own tool-call timeout.

**Limits in `agentic-mcp`** (bundled `src/config/providers.json`; copy a provider into your own config to change them):

| Limit                                                  | Bundled value | Key              | Error when it is hit                                                         |
| ------------------------------------------------------ | ------------- | ---------------- | ---------------------------------------------------------------------------- |
| One provider run (wall clock)                          | 60 min        | `timeout`        | `Process timed out after 3600 s (provider timeout).`                         |
| Waiting for a busy provider slot (`maxConcurrency: 1`) | 10 min        | `queueTimeoutMs` | `Queue timeout for provider "<name>": the provider is busy with other calls` |
| Copilot silence after its first output                 | 10 min        | `idleTimeout`    | `Process killed after no output for 600 s (provider idleTimeout).`           |

`queueTimeoutMs` defaults to 10 min when a provider omits it; `ping_<provider>` and `help_<provider>` wait at most 30 s for a slot and stop when the client cancels. At most 5 provider CLIs run at once; a call whose provider is free waits for one of those 5 slots (oldest call first) for up to 60 min past its `queueTimeoutMs`, and `ask_all` starts at most 5 providers at a time. The `MCP_TOOL_TIMEOUT` that `agentic-mcp` sets for a child `claude` (60 min) only limits that child's own MCP calls; it does not change your client's limit.

**Your MCP client's limit.** When it expires, the client cancels the call and `agentic-mcp` stops the provider CLI, so the work is lost. `agentic-mcp` sends progress notifications only when the client sends a progress token (every 30 s, and at least every 20 s with `stream_live`), and most clients do not extend their limit on progress. Raise the limit above the provider timeout where the client allows it. Checked in October 2026.

| Client      | Default tool-call limit                                                             | How to raise it                                                                                                                                          | Source                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code | `MCP_TOOL_TIMEOUT` (about 28 h); idle limit 30 min for stdio, which progress resets | Per-server `"timeout"` (ms) for `agentic-mcp` in `~/.claude.json` or `.mcp.json`, or the `MCP_TOOL_TIMEOUT` env var                                      | [Claude Code MCP docs](https://code.claude.com/docs/en/mcp)                                                                                                                                                                                                                                                                                                                                        |
| Codex CLI   | 300 s (startup 30 s); progress does not extend it                                   | `tool_timeout_sec = <s>` (and `startup_timeout_sec`) under `[mcp_servers.agentic-mcp]` in `~/.codex/config.toml`                                         | [Codex MCP docs](https://developers.openai.com/codex/mcp); `codex-rs/codex-mcp/src/rmcp_client.rs` at `rust-v0.166.0`                                                                                                                                                                                                                                                                              |
| Gemini CLI  | 10 min; progress does not extend it                                                 | `"timeout": <ms>` under `mcpServers.agentic-mcp` in `~/.gemini/settings.json`                                                                            | [Gemini CLI MCP docs](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md)                                                                                                                                                                                                                                                                                              |
| Antigravity | 180 s ("timed out after 3m0s")                                                      | `"timeoutSeconds": <s>` under `mcpServers.agentic-mcp` in `~/.gemini/config/mcp_config.json` (shared by the agy CLI and Antigravity 2.0)                 | [agy changelog](https://github.com/google-antigravity/antigravity-cli/blob/main/CHANGELOG.md) (1.0.3, 1.1.16); [antigravity-cli#780](https://github.com/google-antigravity/antigravity-cli/issues/780)                                                                                                                                                                                             |
| Copilot CLI | 180 s (maintainer; the CLI reference lists 30 s for `timeout`)                      | `"timeout": <ms>` for the server in `~/.copilot/mcp-config.json` (a project `.mcp.json`, `.github/mcp.json` or `.vscode/mcp.json` entry without it wins) | [Copilot CLI MCP docs](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers); [copilot-cli#1535](https://github.com/github/copilot-cli/issues/1535)                                                                                                                                                                                                            |
| OpenCode    | 60 s, reset by each progress notification                                           | `"timeout": <ms>` under `mcp.agentic-mcp` in `opencode.json`, or `experimental.mcp_timeout`                                                              | [OpenCode MCP docs](https://opencode.ai/docs/mcp-servers/); OpenCode source, `packages/opencode/src/mcp/index.ts` at `v1.19.5`                                                                                                                                                                                                                                                                     |
| Cursor      | 60 s on the agent (ACP) path, with no setting (Inferred)                            | None; use async mode                                                                                                                                     | Cursor forum: [1](https://forum.cursor.com/t/agent-acp-mcp-tools-call-times-out-at-60s-with-no-way-to-configure-it/163925), [2](https://forum.cursor.com/t/acp-mcp-client-should-reset-json-rpc-tool-call-timeout-on-notifications-progress-or-honour-resettimeoutonprogress/160548), [3](https://forum.cursor.com/t/mcp-timeout-happens-even-when-sending-back-updates-via-progress-token/145697) |

**What `setup` writes.** For Codex CLI, Copilot CLI, Gemini CLI, Antigravity and OpenCode, `setup --client <client>` writes the per-server key for the `agentic-mcp` entry: the longest `timeout` plus the longest `queueTimeoutMs` among the enabled providers, plus one minute. Setup reads the providers config the server loads without `--config` (`AGENTIC_MCP_CONFIG`, then `~/.config/agentic-mcp/providers.json`, then the bundled one); with the bundled config, or when the config cannot be loaded, that is 71 min (60 min run, 10 min queue wait). The value is capped at 2^31-1 ms (about 24.8 days), the longest timer a Node client can set. Setup does not count a model-fallback retry, which runs the provider a second time, so such a call can outlast the limit; use async mode for long work. Run setup again after you change the providers config. In merge mode it raises the key only when it is missing or lower, keeps a higher value you set, and lists what it did and how it got the value under "Tool-call timeout" in its output. For Claude Code it writes no timeout: its default limit (about 28 h) is already longer and progress resets its 30 min idle limit, while a per-server `timeout` would replace that default with a hard limit.

| Client                    | Keys `setup` writes for `agentic-mcp`                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code               | Nothing: the default limit is longer, and a `timeout` would replace it with a hard limit. A `timeout` you set stays                             |
| Codex CLI                 | `tool_timeout_sec = 4260` by default, in whole seconds rounded up, and `startup_timeout_sec = 60` (a cold `npx -y` can exceed the 30 s default) |
| Copilot CLI               | `"timeout": 4260000` (ms) by default, with `"type": "local"` and `"tools": ["*"]`, which Copilot CLI requires                                   |
| Gemini CLI                | `"timeout": 4260000` (ms) by default                                                                                                            |
| Antigravity               | `"timeoutSeconds": 4260` by default, in whole seconds rounded up                                                                                |
| OpenCode                  | `"timeout": 4260000` (ms) by default, with `"type": "local"`, the command as one array, and `"enabled": true`                                   |
| Cursor, Windsurf, generic | Nothing: there is no documented key (Inferred from their docs and forum threads), so use async mode for long work                               |

Codex's `config.toml` is merged with a TOML parser. A new `[mcp_servers.agentic-mcp]` table is appended, so your comments and layout stay. Updating an existing table rewrites the file, which drops its comments (setup warns, and the backup keeps the original); if a rewrite would change any other value, setup refuses instead. A `startup_timeout_ms` of at least 60 s is kept rather than adding `startup_timeout_sec`, which Codex would prefer.

For Antigravity, setup writes `~/.gemini/config/mcp_config.json`, the user-level file that the agy CLI and Antigravity 2.0 share and that `agy mcp add|remove|list` manage (agy changelog 1.0.3 and 1.1.16). `timeoutSeconds` is in seconds, not ms: the `/mcp` panel keeps it (changelog 1.1.16), and a user in [antigravity-cli#780](https://github.com/google-antigravity/antigravity-cli/issues/780) reports that it lifts the 3 min limit. The antigravity.google docs could not be fetched to confirm this (network policy blocked them), so the source is that changelog and issue. agy accepts `//` comments and trailing commas in this file; setup reads strict JSON, so a file with them is left unchanged and you add the entry by hand.

**Where the client limit cannot be raised**, or for any task likely to take more than about a minute, use async mode. Call `ask_<provider>` with `mode: "async"`; it returns a `job_id` at once. Then call `ask_<provider>` with `action: "status"` and that `job_id` until the job is done. Each call returns in milliseconds, so no client limit applies. From the CLI, use `--async`, then `--job-id <id>`. Async jobs do not accept `session_id`, cannot be cancelled, live only in the server's memory, and are dropped 15 min after they finish. `review_<provider>` and `ask_all` run only synchronously; for a big review, send a review prompt to `ask_<provider>` in async mode.

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
npx agentic-mcp ask_all "Compare bugfixes" --providers claude,codex --report ./reports/bugfixes.json
```

Use this when you want side-by-side answers without hand-running the same prompt several times. Add `--report <path>` when you want a saved JSON artifact of the comparison.

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

| Provider    | Binary      | Support level | Enabled by default | Notes                                   |
| ----------- | ----------- | ------------- | ------------------ | --------------------------------------- |
| Claude      | `claude`    | stable        | Yes                | ask, sessions                           |
| Codex       | `codex`     | stable        | Yes                | ask, review, sessions                   |
| Copilot     | `copilot`   | stable        | Yes                | ask, sessions                           |
| Gemini      | `gemini`    | stable        | Yes                | ask, sessions                           |
| Antigravity | `agy`       | beta          | Yes                | ask, sessions, model listing; see below |
| OpenCode    | `opencode`  | stable        | Yes                | ask, sessions, model listing            |
| Aider       | `aider`     | community     | Yes                | ask                                     |
| Goose       | `goose`     | beta          | Yes                | ask, sessions                           |
| Amp         | `amp`       | beta          | Yes                | ask                                     |
| Cline       | `cline`     | beta          | Yes                | ask                                     |
| Cursor      | `agent`     | beta          | Yes                | ask                                     |
| Droid       | `droid`     | beta          | Yes                | ask                                     |
| Amazon Q    | `q`         | experimental  | No                 | disabled template with prerequisites    |
| Plandex     | `plandex`   | community     | No                 | disabled template with prerequisites    |
| OpenHands   | `openhands` | experimental  | No                 | disabled template with prerequisites    |
| Qwen Code   | `qwen`      | experimental  | No                 | disabled template with prerequisites    |
| Tabnine     | `tabnine`   | experimental  | No                 | disabled template with prerequisites    |

Provider definitions live in `src/config/providers.json`.

### Antigravity

The `antigravity` provider (`ask_antigravity`) runs Google's Antigravity CLI (`agy`), which replaced Gemini CLI for individual Google accounts on 2026-06-18. The `gemini` provider stays for API-key and enterprise users. The integration is tested against a fake `agy`, not the real binary, so it ships as beta.

- Install `agy` from Google (it is not on npm), then run `agy` once in a terminal to finish sign-in and the one-time onboarding screens. Print mode does not show them, and a run without a login fails fast.
- JSON output needs agy 1.1.8 or newer.
- Some agy versions print the full answer and then never exit ([#1313](https://github.com/google-antigravity/antigravity-cli/issues/1313)). The provider sets `acceptResultOnTimeout`, so agentic-mcp stops agy `resultExitGraceMs` (30 s by default) after it printed a complete result and returns that answer, with a `warning` in the attribution. A printed result that reports an `error` or a `finished_reason` of `error` or `interrupted` is still a failure; a `status` other than `SUCCESS` is named in the warning, since agy sometimes reports `ERROR` next to a correct answer.
- Runs can take up to 60 minutes; agy gets `--print-timeout 58m` so it returns first. agy then prints the answer so far with `finished_reason: "print_timeout"` and exits 0; agentic-mcp returns it with a `warning` in the attribution that the answer may be partial. Other values that mean a partial answer (`error`, `interrupted`, a token limit such as `max_tokens` or `length`, or `timeout`) are named the same way, for any provider; a normal finish such as `stop` or `end_turn` gets no warning. Auto-update is turned off for these runs.
- `autoMode` maps to `--dangerously-skip-permissions`. Without it, print mode denies file writes and commands that need approval. File attachments, a system prompt and the sandbox are not mapped.
- The bundled config passes no credentials. To sign in with `GEMINI_API_KEY` (agy also needs `"modelProvider": "gemini"` in `~/.gemini/antigravity-cli/settings.json`) or with Application Default Credentials (`AGY_ADC_AUTH`, `GOOGLE_APPLICATION_CREDENTIALS`), copy the provider into your own config and add those names to its `envPassthrough`.

### Environment variables

Provider CLIs start with a small base environment: `PATH`, `HOME`, locale, temp dirs, `USER`/`LOGNAME`/`SHELL`, and proxy and CA settings (`HTTP(S)_PROXY`, `NO_PROXY`, `ALL_PROXY`, `NODE_EXTRA_CA_CERTS`, `SSL_CERT_FILE`). Nothing else from your shell reaches them unless the provider lists it in `envPassthrough`. The bundled config passes only each CLI's config-directory variable (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `COPILOT_HOME`, `OPENCODE_CONFIG`), `GOOGLE_CLOUD_PROJECT` for Gemini and Antigravity, and for Antigravity the desktop-Linux keyring variables `DBUS_SESSION_BUS_ADDRESS` and `XDG_RUNTIME_DIR`. It passes no credentials: an API key in the environment overrides a CLI's own login, and `claude -p` always uses `ANTHROPIC_API_KEY` when it is set, which moves a Pro or Max subscription to per-token API billing. If you do authenticate with environment keys, copy the provider into your own config and list them:

```json
"envPassthrough": ["CODEX_HOME", "OPENAI_API_KEY"]
```

`env` sets fixed values and wins over a passed-through one; `"KEY": null` removes a base variable in every spelling (`"https_proxy": null` also drops `HTTPS_PROXY`). Anything the provider CLI runs, including tools it starts in your working directory, can read the variables it was given, so keep each list to what that CLI needs.

## Useful setup flags

`agentic-mcp setup` supports a few flags that matter often:

- `--client antigravity|claude-code|codex|copilot|gemini|opencode|cursor|windsurf|generic` - choose the client whose config is written
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
