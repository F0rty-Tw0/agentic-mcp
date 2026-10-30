# ask-all

Compare multiple providers on the same prompt — `ask_all` is the side-by-side workflow that shows why `agentic-mcp` is useful beyond a single-provider wrapper.

## What It Does

- Runs the same prompt across multiple configured providers in parallel
- Returns a structured side-by-side result with per-provider success status, attribution, and execution timing
- Helps you evaluate differences in answer quality, latency, and failures without bespoke glue scripts
- Supports CLI report export so one comparison can become a reusable JSON artifact via `agentic-mcp ask_all ... --report <path>`
- Keeps provider comparison explicit so single-provider work can stay on `ask_<provider>`
- Follows the caller's request: cancelling `ask_all` aborts every provider run (each one also has its own timeout), and a client progress token gets one heartbeat stream for the whole fan-out

Use `ask_all` when comparison is the goal. Do not use it for routine single-provider work, because it costs more and adds extra output to interpret.

## Structure

| Directory       | Purpose                                                         |
| --------------- | --------------------------------------------------------------- |
| `common/`       | Tool argument types, result types                               |
| `domain-logic/` | Handler (parallel invocation) and tool builder (MCP definition) |
| `utils/`        | Response text extraction from provider results                  |

## Key Files

- `domain-logic/ask-all.handler.ts` — `handleAskAll()` — filters providers, runs them in parallel with `Promise.all`, sends the caller heartbeat, builds the summary
- `domain-logic/ask-all-runner.ts` — `runProviderAsk()` — one provider's `handleAsk` call with its timeout, linked to the caller's abort signal
- `domain-logic/tool.builder.ts` — Builds the `ask_all` MCP tool definition

## Integration Tests

None in this module. `src/server/domain-logic/create-server-cancellation.test.ts` cancels a running `ask_all` against a fake provider CLI and checks that the CLI is killed and no response is sent.

## Unit Tests

4 `.spec.ts` files covering the handler logic (parallel invocation, error handling), the caller's request context (cancellation, heartbeat), tool builder (schema generation), and utility functions (text extraction).
