# Changelog

## [Unreleased]

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

[Unreleased]: https://github.com/F0rty-Tw0/agentic-mcp/compare/v0.1.10...HEAD
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
