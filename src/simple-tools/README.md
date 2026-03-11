# simple-tools

Meta tools — implements the utility MCP tools for provider discovery and limited-scope health checks: `ping`, `help`, and `list_providers`.

## What It Does

- **`ping_<provider>`** — Proves only what the tool actually checked: binary detection or a successful version check, then points the user to `ask_<provider>` for end-to-end proof
- **`help_<provider>`** — Returns the provider's capabilities, description, and supported features
- **`list_providers`** — Returns configured providers with truthful status labels (`binary detected`, `binary missing`, or `disabled`) and the next step needed to prove real usage

## Structure

| Directory       | Purpose                                                   |
| --------------- | --------------------------------------------------------- |
| `common/`       | Tool name constants, handler types                        |
| `domain-logic/` | Handlers for ping, help, list_providers, and tool builder |

## Key Files

- `domain-logic/ping.handler.ts` — `handlePing()` — limited-scope binary/version proof with next-step guidance
- `domain-logic/help.handler.ts` — `handleHelp()` — provider capabilities listing
- `domain-logic/meta.handler.ts` — `handleListProviders()` — all-provider status summary with truthful labels
- `domain-logic/tool.builder.ts` — Builds MCP tool definitions for ping/help/list_providers

## Integration Tests

None directly in this module. All three tools are integration-tested via `server/domain-logic/create-server.test.ts`, which:

- Calls `ping_<provider>` on detected providers and verifies the response stays explicit about its limited proof scope
- Calls `help_<provider>` and verifies non-empty help text is returned
- Calls `list_providers` and verifies provider names, truthful status labels, and next-step guidance appear in the output

These tests exercise the full tool invocation path through the MCP server, not just the handler functions.

## Unit Tests

4 `.spec.ts` files covering each handler (ping, help, list_providers) and the tool builder (schema generation).

## Related Tooling

After a real `ask_<provider>` succeeds, use `provider_metrics` to see which providers you actually used, how often they succeeded, and how long they took. `simple-tools` gets you to the first proof step; `provider_metrics` helps you learn from real usage after that.
