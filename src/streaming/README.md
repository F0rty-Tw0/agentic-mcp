# streaming

MCP progress notifications — manages live output streaming from provider CLI processes to MCP clients via progress notification events.

## What It Does

- Emits real-time `chunk` events as stdout/stderr data arrives from provider processes
- Maintains contiguous sequence numbering across all events in a stream
- Separates events by channel (`stdout` vs `stderr`) for client-side rendering
- Emits a terminal `done` event when the process completes, or a terminal `error` event when it fails
- Holds the `error` event of a run its caller retries (`holdStreamError`), so only the retry's run ends the stream; queued chunks still go out
- Builds execution summaries with timing and token usage metrics
- Only activates when the caller sets `stream_live: true` and provides a progress token

## Structure

| Directory       | Purpose                                                 |
| --------------- | ------------------------------------------------------- |
| `common/`       | Stream event types (chunk, done, error)                 |
| `domain-logic/` | Notifier creation and runtime state management          |
| `utils/`        | Pure helpers: event envelopes, chunk splitting, summary |

## Key Files

- `domain-logic/stream-notifier.builder.ts` — `createStreamNotifier()`
- `utils/notifier.helpers.ts` — `buildExecutionSummary()`, `withEventEnvelope()`, `splitChunkByBytes()`, `createNoopStreamNotifier()`
- `domain-logic/notifier-runtime.ts` — Runtime state management for active streams
- `domain-logic/held-error-notifier.ts` — `holdStreamError()`: wraps a notifier so its `error` event waits for `releaseError()`

## Integration Tests

None directly in this module. Streaming is integration-tested via `ask/domain-logic/ask.handler-streaming.test.ts`, which:

- Spawns a real Node.js process that writes interleaved stdout and stderr
- Enables `stream_live: true` and collects progress notifications
- Verifies contiguous sequence numbering, presence of both channels, and a terminal `done` event

This exercises the full streaming pipeline from process spawn through notification delivery.

## Unit Tests

7 `.spec.ts` files covering stream event types, notifier creation, helper functions, and runtime state management.
