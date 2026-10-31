# Changelog

## [Unreleased]

- **Breaking:** require Node.js 26 or newer (`engines >=26`). Node 26 is the current LTS; builds now target Node 26 and ES2025
- Add the Antigravity CLI (`agy`) as a beta `antigravity` provider (json and stream-json output, native session resume, model listing), with a new `acceptResultOnTimeout` / `resultExitGraceMs` provider opt-in that returns a complete printed result when a CLI does not exit after printing it. A result's `finished_reason` that means a partial answer (such as agy's `print_timeout` or a token limit) is named in the attribution `warning`
- Fix `ask_codex`: codex 0.166 removed `--full-auto`, which made every call fail. Codex now runs with its default read-only sandbox unless `sandbox=workspace-write` is passed
- Update provider flags to the current CLIs: Claude permission modes `auto`/`manual` (`delegate` removed) and effort `xhigh`/`max`, Gemini `--approval-mode yolo`, OpenCode `--auto`, Copilot `--reasoning-effort`
- Fix native session resume for Codex (`exec resume <id>`) and OpenCode (`--session`), and add it for Gemini (`--resume`)
- Pass proxy and CA variables (`HTTP(S)_PROXY`, `NO_PROXY`, `NODE_EXTRA_CA_CERTS`, `SSL_CERT_FILE`, …) to the provider CLIs, and add a per-provider `envPassthrough` list for anything else, such as API keys. The bundled config passes no credentials, so subscription logins keep working
- **Changed:** `env: { KEY: null }` now removes the variable, as the schema documents, instead of setting it to an empty string
- Fix shutdown leaving provider CLIs running: Ctrl-C and server shutdown now SIGKILL a provider group that ignores SIGTERM after a 2 s grace (at once on a second signal), kill a group spawned during that grace, stop groups alongside the MCP close instead of after it (close is bounded at 5 s), and never signal a bare pid once the CLI exited, since another process may have reused it
- Fix `setup --client claude-code`: it now writes `~/.claude.json`, keeps the file's permissions, follows symlinks, never replaces a config that is not strict JSON, keeps every earlier backup, and refuses `--mode overwrite` on Claude Code's state file
- Fix MCP cancellation: a cancelled call stops (also while queued) and gets no response; `ask_all` honors cancel; async jobs and calls without a client progress token send no stray progress notifications
- Fix process handling: a CLI that exits before reading stdin no longer crashes the server, kills reach the whole process group, a killed call settles even when a grandchild holds its output, and Ctrl-C stops provider CLIs in CLI mode
- Fix state handling: running async jobs are no longer pruned after 15 minutes, in-use sessions are not evicted, and the session fallback keeps the conversation history
- Guard prompts that start with `-` so CLIs do not read them as options, and prompts like `constructor` are no longer swallowed by the CLI parser
- Move the toolchain to TypeScript 7, Vitest 5, ESLint 10, lint-suite 3, pnpm 12 and Node 26 LTS
- Raise limits for long runs such as a big PR review: 60 min per provider run (was 30), 10 min to wait for a busy provider (was 30 s), 10 min of copilot silence (was 30 s); a call blocked only by the global cap of 5 CLIs waits up to 60 min more and freed slots go to the oldest call, `ping_<provider>` and `help_<provider>` wait at most 30 s for a slot and honor cancel, `ask_all` starts at most 5 providers at a time, `review_<provider>` sends heartbeats, `stream_live` sends progress at least every 20 s, errors say "no output for N s" (idle), "timed out after N s" (run) or that the provider is busy with what to do, and the tool descriptions, skill and README steer long work to `mode: "async"` (see "Long-running calls")
- `setup` writes each client's tool-call timeout for the `agentic-mcp` entry, derived from the providers config (longest `timeout` plus longest `queueTimeoutMs` plus one minute; 71 min with the defaults), in the new `--client codex` (`tool_timeout_sec`, `startup_timeout_sec` in `~/.codex/config.toml`, merged with a TOML parser), `--client copilot`, `--client gemini` and `--client opencode` targets. For Claude Code it writes none, since its default limit is longer and a per-server `timeout` would replace it. Merge mode keeps the user's other keys in the entry and a higher timeout, and reports what it changed. A remote (`url`) `agentic-mcp` entry a TOML `mcp_servers` that is not a table, or a JSON config or `mcpServers` that is not an object is left for a manual edit instead of being replaced, and setup warns when `CODEX_HOME`, `COPILOT_HOME`, `OPENCODE_CONFIG`, `XDG_CONFIG_HOME` or `CLAUDE_CONFIG_DIR` may move the client's config
- Fix `setup --output json`: stdout is now one JSON document; for Claude Code the skill install result is in its `skillResult` field instead of a `Skill installed: …` line printed after the JSON
- Fix `setup` reruns: when the `agentic-mcp` entry already matches, merge mode writes nothing and makes no `.bak` (write intent and result `unchanged`, reason "already configured"); it still needs `--yes` or a confirmation, since it still installs the Claude Code skill
- Fix `setup --dry-run --client claude-code`: it no longer installs the `using-agentic-mcp` skill, and a run that ends in a manual edit installs it only with `--yes`
- `setup --client claude-code` keeps an existing `agentic-mcp` `timeout` lower than the derived tool-call timeout but adds a note that it cuts long runs short
- `setup --client gemini` warns when `GEMINI_CLI_HOME` is set, since Gemini CLI then reads `$GEMINI_CLI_HOME/.gemini/settings.json`
- Move from `@modelcontextprotocol/sdk` 1.x to the v2 packages `@modelcontextprotocol/server` and `@modelcontextprotocol/client` ^2.4; the stdio server keeps serving 2025-era clients and now also accepts 2026-07-28 clients, and tool input schemas declare JSON Schema 2020-12 instead of draft-07
- **Changed:** with the v2 SDK, closing stdin while a call is running aborts that call without a response (the v2 stdio transport's behavior; it used to answer, then exit). Calling an unknown tool now returns a JSON-RPC error (`-32602 Tool X not found`) instead of a tool result with `isError`, invalid-argument messages are worded differently, CLI errors for an unknown tool start with `agentic-mcp:` instead of `MCP error -32602:`, and tool definitions no longer carry `execution.taskSupport`

## [0.1.12] - 2026-03-13

- Add `agentic-mcp prove` as the fastest real-answer proof path, with optional explicit provider selection
- Add `ask_all --report <path>` so side-by-side comparisons can be saved as reusable JSON artifacts
- Rework onboarding and setup guidance to prefer `prove` over manual first-proof `ask_<provider>` commands where the goal is initial validation
- Make `list_providers`, `ping_<provider>`, `ask_all`, and `provider_metrics` surface more concrete proof and comparison guidance in their user-facing output

## [0.1.11] - 2026-03-12

- Add Wave 3 provider coverage with shipped configs for Aider, Goose, Amp, Cline, Cursor Agent CLI, and Droid
- Add disabled provider templates for Amazon Q, Plandex, OpenHands, Qwen Code, and Tabnine with recorded support levels and prerequisites
- Surface provider `supportLevel` and `prerequisites` in `list_providers` so provider metadata matches actual support status
- Add capability-gated `review_{provider}` tooling with Codex review support first
- Add per-provider FIFO execution queues with distinct queue wait timeouts via `maxConcurrency` and `queueTimeoutMs`
- Verify publish-ready package output with `pnpm run build`, `pnpm run ci`, and `npm pack --dry-run`
- Refresh README coverage for the expanded provider matrix and review tooling

## [0.1.10] - 2026-03-11

- Add `ask_all` aliases so `--provider` maps to `--providers` and `--models` maps to `--model`
- Normalize comma-separated and space-separated `ask_all` provider lists before routing them
- Restrict `ask_all --model` to one shared model value and require `--providers` for provider selection
- Return provider-specific shared-model errors directly in `ask_all` instead of retrying without the requested model
- Document the new `ask_all` flag handling and explicit-model behavior in the README and CLI guidance

## [0.1.9] - 2026-03-10

- Persist provider metrics across separate CLI invocations in a durable per-user store instead of process-local memory
- Resolve metrics storage to OS-native state paths by default and allow overriding the file location with `AGENTIC_MCP_METRICS_PATH`
- Split provider-metrics persistence into smaller data-access subfeatures for path resolution, parsing, locking, file I/O, and summary building
- Serialize concurrent metrics writes with a filesystem lock and unique temp files to prevent corrupted JSON, dropped updates, and rename races under parallel execution
- Recover from invalid persisted metrics during append so stale corrupted files are overwritten instead of spamming repeated warnings
- Harden async ask session polling tests to wait for terminal background-job states instead of relying on a fixed sleep

## [0.1.8] - 2026-03-10

- Add `agentic-mcp init` as a minimal onboarding alias for `setup --minimal`, installing the bundled skill before any MCP client config is written
- Add `--minimal` setup output and guidance so users see suggested next-step commands after skill-first installation

## [0.1.7] - 2026-03-09

- Broaden model correction to validate explicit model inputs against provider-reported available models before execution
- Fix hyphenated and shorthand model resolution for LLM-generated inputs while avoiding ambiguous tied rewrites
- Extract top-level `result` text from JSON provider responses while preserving parsed payload metadata
- Surface opt-in structured content in CLI output and async job status responses
- Limit in-process CLI tool execution to the requested provider instead of loading every provider

## [0.1.6] - 2026-03-09

- Add in-process CLI tool execution so CLI subcommands call the matching MCP tools directly
- Add live CLI progress rendering for `ask_<provider> --stream-live`
- Improve typed CLI subcommand handling and argument parsing for shared ask/ask_all options and async status checks
- Update CLI help text and README with the expanded command list, options, and examples

## [0.1.5] - 2026-03-07

- Fix timeout handling to use provider-specific timeout when configured, falling back to MCP default
- Add `resolveAskTimeoutMs` function for clearer timeout resolution logic

## [0.1.4] - 2026-03-07

- Add fuzzy model matching via `selectClosestAvailableModel` when exact model not found
- Add `resolveRequestedModel` to remap models using provider's available model listing
- Add copilot model alias resolution (e.g. `codex 5.3` → `gpt-5.3-codex`)
- Integrate model resolution into ask pipeline before CLI arg building
- Add edge-case test coverage for output parser (JSON strings, empty/malformed NDJSON)

## [0.1.3] - 2026-03-06

- Remove `--no-auto-update` from Copilot provider trailing args to fix model validation rejecting newer models (e.g. `gpt-5.3-codex`)

## [0.1.2] - 2026-03-05

- Fix runtime crash caused by `vitest` leaking into production bundle via barrel re-export

## [0.1.1] - 2026-03-05

- Add automated release workflow with release-it
- Configure npm publish with provenance
- Add GitHub Actions release workflow (manual dispatch)
- Lock down package exports to CLI-only usage

## [0.1.0] - 2026-03-01

- Multi-model AI gateway exposing CLI AI tools as MCP servers
- Providers: Claude, Codex, Copilot, Gemini, OpenCode
- Config-driven provider definitions with Zod validation
- Session management with locking for multi-turn conversations
- Background async job queue for long-running queries
- Per-provider metrics (call counts, response times, success rates)
- Live output streaming via MCP progress notifications
- `agentic-mcp setup` CLI for configuring MCP clients
- `ask_all` fan-out to all providers in parallel

[Unreleased]: https://github.com/F0rty-Tw0/agentic-mcp/compare/v0.1.12...HEAD
[0.1.12]: https://github.com/F0rty-Tw0/agentic-mcp/compare/v0.1.11...v0.1.12
[0.1.11]: https://github.com/F0rty-Tw0/agentic-mcp/compare/v0.1.10...v0.1.11
[0.1.10]: https://github.com/F0rty-Tw0/agentic-mcp/compare/v0.1.9...v0.1.10
[0.1.9]: https://github.com/F0rty-Tw0/agentic-mcp/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/F0rty-Tw0/agentic-mcp/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/F0rty-Tw0/agentic-mcp/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/F0rty-Tw0/agentic-mcp/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/F0rty-Tw0/agentic-mcp/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/F0rty-Tw0/agentic-mcp/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/F0rty-Tw0/agentic-mcp/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/F0rty-Tw0/agentic-mcp/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/F0rty-Tw0/agentic-mcp/releases/tag/v0.1.1
[0.1.0]: https://github.com/F0rty-Tw0/agentic-mcp/releases/tag/v0.1.0
