# session

Session store with locking — provides thread-safe, in-memory multi-turn conversation state management with per-provider isolation.

## What It Does

- Maintains conversation sessions identified by `(providerName, sessionId)` pairs
- Stores turn history (user/assistant message pairs) for each session
- Provides lock-based concurrency control: `tryAcquireLock()` / `releaseLock()` prevent concurrent writes to the same session
- Tracks native provider session IDs (for providers like Claude that have their own session concept)
- Lists active sessions by provider via `listByProvider()`
- Exported as a singleton `SESSION_STORE` for use across the application

## Structure

| Directory      | Purpose                                                              |
| -------------- | -------------------------------------------------------------------- |
| `common/`      | Session types (turn shape, session record, lock state)               |
| `data-access/` | `InMemorySessionStore` singleton                                     |
| `utils/`       | Session ID extraction from provider responses, store utility helpers |

## Key Files

- `data-access/session-store.ts` — `InMemorySessionStore` — thread-safe session state with lock management, turn storage, and provider-scoped listing

## Integration Tests

None directly in this module. Session management is thoroughly integration-tested via `ask/domain-logic/ask.handler-sessions.test.ts`, which exercises:

- Lock contention (two concurrent calls to the same session)
- Sequential turn accumulation across multiple calls
- Session listing by provider name

These tests use `SESSION_STORE` directly and verify the store's behavior end-to-end through `handleAsk`.

## Unit Tests

3 `.spec.ts` files covering the session store (CRUD, locking, eviction), session ID extraction from provider responses, and store utility helpers.
