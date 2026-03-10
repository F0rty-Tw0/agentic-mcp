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
- `domain-logic/ask-session-flow.ts` — builds session flow state and retries native-session failures with tier-1 fallback
- `domain-logic/sessions.handler.ts` — renders provider-scoped session listings for MCP tools
- `utils/session-metadata.util.ts` — merges session mode metadata into MCP responses

## Test Coverage

Session behavior is covered by unit tests in this module plus ask integration tests in `ask/domain-logic/ask.handler-sessions.test.ts`, including:

- Lock contention for concurrent requests to the same session
- Sequential turn accumulation across multiple ask calls
- Session listing by provider name
- Native session ID extraction and fallback behavior
