# Changelog

## [Unreleased]

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

## [0.1.0] — Initial release

- Multi-model AI gateway exposing CLI AI tools as MCP servers
- Providers: Claude, Codex, Copilot, Gemini, OpenCode
- Config-driven provider definitions with Zod validation
- Session management with locking for multi-turn conversations
- Background async job queue for long-running queries
- Per-provider metrics (call counts, response times, success rates)
- Live output streaming via MCP progress notifications
- `agentic-mcp setup` CLI for configuring MCP clients
- `ask_all` fan-out to all providers in parallel

[Unreleased]: https://github.com/F0rty-Tw0/agentic-mcp/compare/v0.1.6...HEAD
[0.1.6]: https://github.com/F0rty-Tw0/agentic-mcp/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/F0rty-Tw0/agentic-mcp/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/F0rty-Tw0/agentic-mcp/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/F0rty-Tw0/agentic-mcp/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/F0rty-Tw0/agentic-mcp/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/F0rty-Tw0/agentic-mcp/releases/tag/v0.1.1
