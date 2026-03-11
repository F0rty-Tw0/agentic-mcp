# provider-metrics

File-backed provider usage feedback — `provider_metrics` shows which providers you actually used, how often they succeeded, and how long they took.

## What It Does

- Aggregates file-backed call records into a per-provider summary
- Shows total calls, success count, failure count, average response time, and the last successful call time
- Exposes the `provider_metrics` MCP tool for users who want feedback on real usage, not just setup state
- Returns machine-readable JSON so MCP clients and scripts can inspect the same summary

## Structure

| Directory       | Purpose                                  |
| --------------- | ---------------------------------------- |
| `common/`       | Metrics types (per-provider stats shape) |
| `data-access/`  | File-backed metrics storage and loading  |
| `domain-logic/` | Metrics handler and tool builder         |

## Key Files

- `data-access/provider-metrics-store.ts` — Appends call records and loads the metrics summary source file
- `domain-logic/provider-metrics.handler.ts` — `handleProviderMetrics()` — returns the current JSON summary for user-facing usage feedback

## Integration Tests

None. The `provider_metrics` tool is registered and callable via the `server/` integration tests (`create-server-schema.test.ts` verifies `provider_metrics` is registered as a global tool). Direct integration testing would require making real provider calls to generate metrics data.

## Unit Tests

2 `.spec.ts` files covering the metrics store (recording, retrieval, reset) and the handler (response formatting).
