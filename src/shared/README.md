# shared

Cross-cutting concerns — reusable modules shared across multiple features. Contains four sub-modules: command execution, provider config, MCP protocol utilities, and validation.

## Sub-Modules

### command-execution

Process spawning and stream collection — executes provider CLIs as child processes.

- Spawns commands via `cross-spawn` (never `shell: true`) with output streaming
- Enforces concurrency limits via a counting semaphore
- Collects stdout/stderr streams with configurable output capping
- Handles timeout enforcement and abort signal propagation
- Tracks active processes for cancellation notification support

**Key files:**
- `domain-logic/command-executor.ts` — `executeCommand()` — spawns child processes and collects output
- `domain-logic/semaphore.ts` — Counting semaphore for concurrency limiting
- `domain-logic/command-stream-collector.util.ts` — Accumulates stdout/stderr into a result object

**Unit tests:** 7 `.spec.ts` files covering command execution, semaphore behavior, streaming collection, error types, and platform utilities.

---

### provider

Provider configuration types and environment resolution.

- Defines `ProviderConfig`, `ResolvedProviderEntry`, `ResolvedProvider` types
- Resolves environment variables (API keys, tokens) from provider config
- Detects model-related errors in provider output
- Exports Zod schemas (`providersFileSchema`) for config validation
- Provides test stubs/factories in `common/stubs/`

**Key files:**
- `domain-logic/provider-env-resolver.ts` — Resolves env vars from provider config's `env` map

**Unit tests:** 1 `.spec.ts` file covering environment variable resolution.

---

### mcp-protocol

MCP protocol utilities — types and helpers for MCP communication.

- Defines MCP content types (`McpTextContent`, `McpImageContent`)
- Converts errors to MCP-compatible error responses
- Provides heartbeat/keep-alive signaling utilities

**Key files:**
- `utils/heartbeat.util.ts` — Keep-alive signaling for long-running operations
- `utils/to-mcp-error.util.ts` — Error-to-MCP-response conversion

**Unit tests:** 2 `.spec.ts` files covering heartbeat timing and error conversion.

---

### validation

Request validation and registry — validates tool arguments and provides Zod utilities.

- Maintains a request registry for tracking active ask invocations
- Provides date/time validation utilities
- Exports Zod validation helpers used across the project

**Key files:**
- `domain-logic/request-registry.ts` — Validates and registers ask args with active process tracking

**Unit tests:** 3 `.spec.ts` files covering request registry, date/time validation, and Zod utilities.

## Integration Tests

None directly in this module. The shared utilities are exercised transitively through integration tests in other modules:
- `command-executor` is tested via every `ask/` integration test that spawns real child processes
- `provider` types are used in all integration test fixtures
- `mcp-protocol` utilities are tested via `server/` integration tests
- `validation` is exercised whenever `handleAsk` validates args in integration tests
