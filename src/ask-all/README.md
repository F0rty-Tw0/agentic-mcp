# ask-all

Fan-out to all providers — implements the `ask_all` MCP tool that sends a prompt to every configured provider in parallel and aggregates their responses.

## What It Does

- Receives a prompt and invokes `handleAsk` for each resolved provider concurrently using `Promise.allSettled`
- Collects responses from all providers, including those that fail or time out
- Formats a combined response with per-provider attribution and execution timing
- Builds the `ask_all` MCP tool definition with its input schema

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
