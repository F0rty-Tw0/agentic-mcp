# tool-registry

MCP tool registration — registers all MCP tools with the server instance, building tool definitions from provider configuration and wiring them to their handlers.

## What It Does

- Iterates over resolved providers and registers per-provider tools: `ask_<name>`, `ping_<name>`, `help_<name>`, `sessions_<name>`
- Registers global tools: `ask_all`, `list_providers`, `provider_metrics`
- Builds input schemas (JSON Schema) for each tool from provider config (supported flags, session support, etc.)
- Wires each tool to its handler function with the correct provider context

## Structure

| Directory       | Purpose                                          |
| --------------- | ------------------------------------------------ |
| `common/`       | Tool registry types                              |
| `domain-logic/` | Tool registry orchestration and ask tool builder |
| `utils/`        | Tool args predicates, SDK boundary adapters      |

## Key Files

- `domain-logic/tool-registry.ts` — `registerAllTools()` — main registration function that connects providers to MCP tools
- `domain-logic/ask-tool.builder.ts` — Builds `ask_<provider>` tool definitions with dynamic input schemas based on provider capabilities
- `utils/progress-context.util.ts` — `toProgressContext()` — adapts the SDK's per-request `ctx` into the `ProgressContext` the handlers take
- `utils/input-schema.util.ts` — `toInputSchema()` — wraps a tool definition's raw zod shape in `z.object()` for `registerTool`

## Integration Tests

None directly in this module. Tool registration is integration-tested via `server/` tests:

- `create-server.test.ts` — Verifies all expected tools are registered and callable through the MCP client
- `create-server-schema.test.ts` — Verifies config-to-tool-schema fidelity: input schemas have correct fields, descriptions are non-empty, per-provider tool triples are complete, and global tools are present

These tests exercise `registerAllTools()` indirectly through `createServer()`.

## Unit Tests

9 `.spec.ts` files covering the tool registry (registration logic, handler wiring, progress-context wiring), the ask and review tool builders (schema generation from provider config), and the `utils/` adapters.
