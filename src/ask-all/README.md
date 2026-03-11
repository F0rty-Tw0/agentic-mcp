# ask-all

Compare multiple providers on the same prompt — `ask_all` is the side-by-side workflow that shows why `agentic-mcp` is useful beyond a single-provider wrapper.

## What It Does

- Runs the same prompt across multiple configured providers in parallel
- Returns a structured side-by-side result with per-provider success status, attribution, and execution timing
- Helps you evaluate differences in answer quality, latency, and failures without bespoke glue scripts
- Keeps provider comparison explicit so single-provider work can stay on `ask_<provider>`

Use `ask_all` when comparison is the goal. Do not use it for routine single-provider work, because it costs more and adds extra output to interpret.

## Structure

| Directory       | Purpose                                                         |
| --------------- | --------------------------------------------------------------- |
| `common/`       | Tool argument types, result types                               |
| `domain-logic/` | Handler (parallel invocation) and tool builder (MCP definition) |
| `utils/`        | Response text extraction from provider results                  |

## Key Files

- `domain-logic/ask-all.handler.ts` — `handleAskAll()` — parallel invocation of `handleAsk` for each provider with `Promise.allSettled`
- `domain-logic/tool.builder.ts` — Builds the `ask_all` MCP tool definition

## Integration Tests

None. The `ask_all` handler is exercised indirectly through server-level integration tests in `src/server/`. Direct integration testing would require multiple real provider CLIs to be installed.

## Unit Tests

3 `.spec.ts` files covering the handler logic (parallel invocation, error handling), tool builder (schema generation), and utility functions (text extraction).
