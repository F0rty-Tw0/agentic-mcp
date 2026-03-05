# Changelog

## [Unreleased]

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

[Unreleased]: https://github.com/F0rty-Tw0/agentic-mcp/compare/vv0.1.1...HEAD
[0.1.1]: https://github.com/F0rty-Tw0/agentic-mcp/releases/tag/vv0.1.1
