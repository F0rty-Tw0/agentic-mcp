# session

Session state and session-aware ask orchestration — provides in-memory multi-turn conversation state, native session tracking, session metadata shaping, and provider-scoped session listing.

## What It Does

- Maintains conversation sessions identified by `(providerName, sessionId)` pairs
- Stores turn history (user/assistant message pairs) for each session
- Provides lock-based concurrency control: `tryAcquireLock()` / `releaseLock()` prevent concurrent writes to the same session
- Tracks native provider session IDs for providers that manage their own session concept
- Builds session-aware prompts and execution flow state for ask requests
- Appends session metadata to MCP responses and lists active sessions by provider
- Exports a singleton `SESSION_STORE` for use across the application

## Structure

| Directory       | Purpose                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| `common/`       | Session types, shared constants, and session execution mode types             |
| `data-access/`  | `InMemorySessionStore` singleton                                              |
| `domain-logic/` | Session-aware ask flow helpers and `sessions_<provider>` listing handler      |
| `utils/`        | Session ID extraction, prompt assembly, metadata shaping, and store utilities |

## Key Files

- `data-access/session-store.ts` — `InMemorySessionStore` with locking, turn storage, native session tracking, and provider-scoped listing
- `data-access/session-native-start.ts` — records a native session id on a store entry, or turns native start off for it
- `domain-logic/ask-session-flow.ts` — builds session flow state, retries native-session failures with tier-1 fallback, and reruns once without the start flag only when the CLI rejects it as an unknown option; all runs of one call share one stream (`withAskStream`), and a run it will retry sends no `error` stream event
- `utils/session-flow-retry.util.ts` — decides when a failed run falls back to tier 1, or retries without the start flag (only when one stderr line, with ANSI colour codes stripped, rejects that flag: `unknown option`, `unrecognized argument`, clap's `unexpected argument '--flag' found`, or yargs' `Unknown argument: flag`); `canSessionFlowRetry` is either
- `domain-logic/sessions.handler.ts` — renders provider-scoped session listings for MCP tools
- `utils/session-metadata.util.ts` — merges session mode metadata into MCP responses

## Test Coverage

Session behavior is covered by unit tests in this module plus ask integration tests in `ask/domain-logic/ask.handler-sessions.test.ts`, including:

- Lock contention for concurrent requests to the same session
- Sequential turn accumulation across multiple ask calls
- Session listing by provider name
- Native session ID extraction and fallback behavior
- Starting a native session with a generated id when the provider sets `commands.sessions.flags.startWithId` (`ask/domain-logic/ask.handler-copilot.test.ts`)
- A failed resume whose replay starts a new native id, so the next turn resumes it in one run (`ask/domain-logic/ask.handler-copilot-lost-session.test.ts`)
- A CLI that rejects the start flag as an unknown option: one retry without it, then the session replays without the flag; any other failure on a start run is returned once with no retry (`ask/domain-logic/ask.handler-copilot-start-retry.test.ts`)
- With `stream_live`, a start-flag rerun or a tier-1 fallback leaves no `error` event from the failed run; a failure that is not retried still ends the stream with `error` (`ask/domain-logic/ask.handler-copilot-retry-stream.test.ts`)
- A retried call keeps one `streamId`, and its `progress` values keep rising across the runs; without `stream_live`, the rerun does not restart the caller heartbeat (`ask/domain-logic/ask.handler-copilot-retry-progress.test.ts`)
