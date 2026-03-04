# ask

Per-provider ask handler — the core feature of agentic-mcp. Routes prompts to individual AI provider CLIs (Claude, Codex, Copilot, Gemini, OpenCode) and returns their responses.

## What It Does

- Receives a prompt and provider context, builds the CLI command, spawns the provider process, and parses the response
- Supports three execution modes: **sync** (default), **async** (background job), and **session** (multi-turn conversation)
- Handles live output streaming via MCP progress notifications when `stream_live` is enabled
- Supports request cancellation via `AbortSignal` and per-provider timeout enforcement
- Manages session locking to prevent concurrent writes to the same conversation thread

## Structure

| Directory       | Purpose                                                                           |
| --------------- | --------------------------------------------------------------------------------- |
| `common/`       | Flag definitions, tool arg types, session mode types, progress notification types |
| `domain-logic/` | Core ask execution: handler routing, command building, response formatting        |
| `session/`      | Session flow execution, metadata tracking, turn history management                |
| `utils/`        | Command parsing, response parsing, output capping utilities                       |

## Key Files

- `domain-logic/ask.handler.ts` — Main entry point; routes to sync/async/session code paths
- `domain-logic/ask-runner.ts` — Executes the provider CLI command and collects output
- `domain-logic/ask-command.ts` — Builds the CLI command array from tool arguments
- `domain-logic/ask-runner-response.builder.ts` — Formats raw output into MCP `CallToolResult`
- `session/domain-logic/ask-session-flow.ts` — Orchestrates multi-turn session execution

## Integration Tests

Run with: `pnpm run test:integration`

### `ask.handler-streaming.test.ts`

Tests live streaming via MCP progress notifications using a real Node.js child process that writes interleaved stdout/stderr output.

| Test                                      | What It Verifies                                                                                                                                                | Expected Output                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Stream with interleaved stdout and stderr | Progress notifications are emitted with contiguous sequence numbers, both `stdout` and `stderr` channels appear, and the final event is a `done` terminal event | `result.isError` is falsy; events contain both channel types; last event type is `"done"` |

### `ask.handler-cancellation.test.ts`

Tests request cancellation and timeout behavior using real child processes that run for 5 seconds.

| Test                         | What It Verifies                                                                                                         | Expected Output                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Abort signal cancellation    | When `AbortController.abort()` fires after 200ms, the long-running process is killed and the response indicates an error | `result.isError` is `true`                                                        |
| Provider timeout enforcement | When the provider timeout (500ms) is shorter than the process duration (5s), the process is killed with a timeout error  | `result.isError` is `true`; error text matches `/timed?\s*out\|timeout\|killed/i` |

### `ask.handler-sessions.test.ts`

Tests session management end-to-end: lock contention, sequential turn accumulation, and session listing.

| Test                                  | What It Verifies                                                                                    | Expected Output                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Concurrent calls with same session_id | When two calls race on the same session, one succeeds and the other returns a lock-contention error | Exactly 1 success and 1 failure; failure text contains `"session in use"` and the session ID |
| Sequential calls release the lock     | After the first call completes, a second call to the same session succeeds                          | Both `firstResult.isError` and `secondResult.isError` are falsy                              |
| Turns accumulate in the store         | After two sequential calls, the session store contains at least 4 turns (2 user + 2 assistant)      | `record.turns.length >= 4`                                                                   |
| Session listing by provider           | After a session call, `SESSION_STORE.listByProvider()` includes the session ID                      | `sessionIds` array contains the test session ID                                              |

## Unit Tests

21 `.spec.ts` files covering handler routing, command building, response formatting, session flow, output parsing, and utility functions.
