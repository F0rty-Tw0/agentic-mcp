# provider-metrics

Per-provider call statistics tracker — records call counts, response times, success rates, and error information for the current session.

## What It Does

- Tracks metrics per provider: total calls, successful calls, failed calls, average response time
- Records the last error message for each provider
- Exposes the `provider_metrics` MCP tool for clients to query session statistics
- Stores all data in memory (resets on server restart)

## Structure

| Directory       | Purpose                                  |
| --------------- | ---------------------------------------- |
| `common/`       | Metrics types (per-provider stats shape) |
| `data-access/`  | In-memory metrics store                  |
| `domain-logic/` | Metrics handler and tool builder         |

## Key Files

- `data-access/provider-metrics-store.ts` — In-memory store with `recordCall()`, `recordError()`, `getMetrics()`
- `domain-logic/provider-metrics.handler.ts` — `handleProviderMetrics()` — formats metrics into an MCP response

## Integration Tests

None. The `provider_metrics` tool is registered and callable via the `server/` integration tests (`create-server-schema.test.ts` verifies `provider_metrics` is registered as a global tool). Direct integration testing would require making real provider calls to generate metrics data.

## Unit Tests

2 `.spec.ts` files covering the metrics store (recording, retrieval, reset) and the handler (response formatting).
