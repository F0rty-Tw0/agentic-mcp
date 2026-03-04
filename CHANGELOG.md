# Changelog

## 0.1.0 — Initial release

- Multi-model AI gateway exposing CLI AI tools as MCP servers
- Providers: Claude, Codex, Copilot, Gemini, OpenCode
- Config-driven provider definitions with Zod validation
- Session management with locking for multi-turn conversations
- Background async job queue for long-running queries
- Per-provider metrics (call counts, response times, success rates)
- Live output streaming via MCP progress notifications
- `agentic-mcp setup` CLI for configuring MCP clients
- `ask_all` fan-out to all providers in parallel
