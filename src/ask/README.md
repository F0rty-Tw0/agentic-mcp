# ask

Per-provider ask handler — the core feature of agentic-mcp. Routes prompts to individual AI provider CLIs (Claude, Codex, Copilot, Gemini, Antigravity, OpenCode, and more) and returns their responses.

## What It Does

- Receives a prompt and provider context, builds the CLI command, spawns the provider process, and parses the response
- Supports three execution modes: **sync** (default), **async** (background job), and **session** (multi-turn conversation)
- Handles live output streaming via MCP progress notifications when `stream_live` is enabled
- Supports request cancellation via `AbortSignal` and per-provider timeout enforcement
- For providers with `acceptResultOnTimeout`, returns a complete printed result (json envelope or terminal stream-json result event) that reports no error (`error`, or `finished_reason` `error`/`interrupted`) as a success with an attribution `warning` when the CLI is killed by timeout or does not exit `resultExitGraceMs` after printing it (`utils/complete-result.util.ts`)
- Names a json or stream-json result's `finished_reason` (such as agy's `print_timeout`) in the attribution `warning`, on any exit path, because the answer may be partial (`utils/result-envelope.util.ts`)
- Manages session locking to prevent concurrent writes to the same conversation thread

## Structure

| Directory       | Purpose                                                                           |
| --------------- | --------------------------------------------------------------------------------- |
| `common/`       | Flag definitions, tool arg types, session mode types, progress notification types |
| `domain-logic/` | Core ask execution: handler routing, command building, response formatting        |
| `utils/`        | Command parsing, response parsing, output capping utilities                       |

Session flow (multi-turn runs, metadata, turn history) lives in the separate `src/session/` module.

## Key Files

- `domain-logic/ask.handler.ts` — Main entry point; routes to sync/async/session code paths
- `domain-logic/ask-runner.ts` — Executes the provider CLI command and collects output into the stream notifier its caller passes; with `willRetry`, a failed run its caller will retry sends no terminal `error` stream event
- `domain-logic/ask-stream.ts` — `withAskStream()`: opens one stream notifier and one heartbeat per `ask_<provider>` call, so every CLI run of a retried call shares one `streamId` and rising `progress`
- `domain-logic/ask-runner-failure.ts` — Builds the failed-run result and its stream error for a non-zero exit or a thrown error
- `domain-logic/ask-heartbeat.ts` — Starts the caller heartbeat for `ask_<provider>` and `review_<provider>` calls unless `stream_live` sends its own
- `domain-logic/ask-command.ts` — Builds the CLI command array from tool arguments
- `domain-logic/ask-runner-response.builder.ts` — Formats raw output into MCP `CallToolResult`
- `../session/domain-logic/ask-session-flow.ts` — Orchestrates multi-turn session execution (session module)

## Integration Tests

Run with: `pnpm run test:integration`

### `ask.handler-streaming.test.ts`

Tests live streaming via MCP progress notifications using a real Node.js child process that writes interleaved stdout/stderr output.

| Test                                      | What It Verifies                                                                                                                                                | Expected Output                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Stream with interleaved stdout and stderr | Progress notifications are emitted with contiguous sequence numbers, both `stdout` and `stderr` channels appear, and the final event is a `done` terminal event | `result.isError` is falsy; events contain both channel types; last event type is `"done"` |

### `ask.handler-antigravity.test.ts`

Runs the bundled `antigravity` config against a fake `agy` (`test/fixtures/fake-agy/agy`) that rejects unknown or stray arguments like agy print mode.

| Test                             | What It Verifies                                                                         | Expected Output                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| json answer                      | The top-level `response` of the json envelope is the answer                              | Text is `agy-fake: hello`                              |
| json session resume              | A second call in one session passes `--conversation <conversation_id>`                   | Text contains `(resumed <id>)`                         |
| stream-json answer and resume    | `{"event":"result","result":{...}}` gives the answer and the conversation id             | Same as json                                           |
| Result printed, then never exits | The run is stopped after `resultExitGraceMs` and the printed answer returned (agy #1313) | Success, well under the timeout, attribution `warning` |

### `ask.handler-copilot.test.ts`

Runs the bundled `copilot` config against a fake `copilot` (`test/fixtures/fake-copilot/copilot`) that rejects unknown or stray arguments and prints the argv it received.

| Test                     | What It Verifies                                                                 | Expected Output                                          |
| ------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| First ask in a session   | The run starts copilot with one `--session-id=<uuid>` argument and no `--resume` | argv holds `--session-id=<uuid>`                         |
| Follow-up in the session | The run passes `--resume <same uuid>` and only the new prompt, with no replay    | argv ends with `--resume <uuid>`, `-p` is the new prompt |
| `help_copilot`           | The help text ends with the agentic-mcp session support line                     | `agentic-mcp sessions: native resume. ...`               |

### `ask.handler-copilot-lost-session.test.ts` and `ask.handler-copilot-start-retry.test.ts`

Run the bundled `copilot` config against the same fake. Test switches in the env: `FAKE_COPILOT_RUN_LOG` logs each run's argv, `FAKE_COPILOT_LOST_SESSION=<id>` fails `--resume <id>`, `FAKE_COPILOT_REJECT_SESSION_ID=1` rejects `--session-id=` as an unknown option, and `FAKE_COPILOT_FAIL_RUN=1` fails every run with a generic error.

| Test                       | What It Verifies                                                                 | Expected Output                                       |
| -------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Lost session, follow-up    | The failed resume falls back to a replay that starts a new `--session-id=<uuid>` | A new uuid, not the first one                         |
| Lost session, next turn    | Copilot runs once and resumes the new id                                         | One run, argv ends with `--resume <new uuid>`         |
| Start flag rejected, ask 1 | The ask reruns once without `--session-id=` and succeeds                         | Two runs: with the flag, then without; no error       |
| Start flag rejected, ask 2 | The session no longer passes the flag and replays the first turn                 | One run, no `--session-id=`, `-p` holds the old turns |
| Generic failure, ask 1     | A failure that is not a flag rejection is not rerun                              | One run, with `--session-id=`; error returned         |
| Generic failure, ask 2     | The session keeps passing the start flag                                         | One run, with `--session-id=`                         |

### `ask.handler-copilot-retry-stream.test.ts`

Runs the same fake with `stream_live: true` and records the type of each progress event.

| Test                             | What It Verifies                                                     | Expected Output                            |
| -------------------------------- | -------------------------------------------------------------------- | ------------------------------------------ |
| Start flag rejected, then rerun  | The rejected run sends its output but no `error`; the rerun ends it  | `start`, `chunk`, `start`, `chunk`, `done` |
| Lost session, then replay        | The failed resume sends no `error`; the replay's run ends the stream | No `error` event; last event is `done`     |
| Generic failure on the start run | A failure that is not retried still ends the stream with `error`     | Last event is `error`                      |

### `ask.handler-copilot-retry-progress.test.ts`

Runs the same fake with a progress token and records each progress notification of one retried `ask_copilot` call. The rerun's second `start` continues the call's stream.

| Test                                     | What It Verifies                                              | Expected Output                                |
| ---------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| Start flag rejected, then rerun          | Both runs stream under one id with rising progress            | One `streamId`; `progress` and `sequence` rise |
| Start flag rejected, rerun fails too     | The failed rerun's `error` ends the same stream               | One `streamId`; `progress` rises               |
| Lost session, then replay                | The failed resume and the replay stream under one id          | One `streamId`; `progress` rises               |
| Start flag rejected, without stream_live | The rerun does not restart the caller heartbeat at progress 0 | Heartbeat `progress` values are `[0]`          |

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

27 `.spec.ts` files covering handler routing, command building, response formatting, session flow, output parsing, and utility functions.
