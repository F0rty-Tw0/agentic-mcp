# simple-tools

Meta tools — implements the utility MCP tools for provider discovery and health checking: `ping`, `help`, and `list_providers`.

## What It Does

- **`ping_<provider>`** — Checks if a provider CLI binary is available on the system and returns its readiness status (`available` or `not found`)
- **`help_<provider>`** — Returns the provider's capabilities, description, and supported features
- **`list_providers`** — Returns a summary of all configured providers with their status (available, not found, or disabled)

## Structure

| Directory | Purpose |
|-----------|---------|
| `common/` | Tool name constants, handler types |
| `domain-logic/` | Handlers for ping, help, list_providers, and tool builder |

## Key Files

- `domain-logic/ping.handler.ts` — `handlePing()` — binary availability check
- `domain-logic/help.handler.ts` — `handleHelp()` — provider capabilities listing
- `domain-logic/meta.handler.ts` — `handleListProviders()` — all-provider status summary
- `domain-logic/tool.builder.ts` — Builds MCP tool definitions for ping/help/list_providers

## Integration Tests

None directly in this module. All three tools are integration-tested via `server/domain-logic/create-server.test.ts`, which:
- Calls `ping_<provider>` on available providers and verifies the response contains `"available"`
- Calls `help_<provider>` and verifies non-empty help text is returned
- Calls `list_providers` and verifies provider names and status labels appear in the output

These tests exercise the full tool invocation path through the MCP server, not just the handler functions.

## Unit Tests

4 `.spec.ts` files covering each handler (ping, help, list_providers) and the tool builder (schema generation).
