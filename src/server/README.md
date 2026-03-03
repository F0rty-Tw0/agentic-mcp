# server

MCP server factory — creates and configures the Model Context Protocol server instance with all registered tools, transport handling, and cancellation notification support.

## What It Does

- Loads provider configuration and resolves which CLI binaries are available on the system
- Creates an `McpServer` instance with the application name and version
- Registers all MCP tools (per-provider ask/ping/help/sessions + global ask_all/list_providers/provider_metrics)
- Handles MCP `CancelledNotification` by killing the associated child process
- Connects to stdio transport for communication with MCP clients

## Structure

| Directory | Purpose |
|-----------|---------|
| `common/` | Server name constant, no-providers warning message |
| `domain-logic/` | Server creation and wiring |
| `utils/` | Request ID string conversion |

## Key Files

- `domain-logic/create-server.ts` — `createServer()` — loads config, resolves providers, creates McpServer, registers tools, sets up cancellation handler
- `common/server.constants.ts` — `SERVER_NAME` and `NO_PROVIDERS_WARNING`

## Integration Tests

Run with: `pnpm run test:integration`

### `create-server.test.ts`

Exercises the full MCP server wiring end-to-end using `InMemoryTransport` (no network, no Docker). A real server and client are connected in `beforeAll` and torn down in `afterAll`.

| Test | What It Verifies | Expected Output |
|------|-----------------|-----------------|
| Tool listing includes `list_providers` | The global `list_providers` tool is registered | `toolNames` contains `"list_providers"` |
| Per-provider tool completeness | Every `ask_<provider>` tool has a matching `ping_<provider>` and `help_<provider>` | All provider triples are present |
| Every tool has a description | No tool is registered without a description string | `tool.description` is truthy for all tools |
| Ping returns availability | Calling `ping_<provider>` for an available provider returns a message containing `"available"` | Response text contains provider name and `"available"` |
| Help returns non-empty text | Calling `help_<provider>` returns meaningful help content | Response text length > 0 |
| list_providers returns provider status | Calling `list_providers` returns text mentioning at least one known provider | Text matches provider name pattern |
| list_providers shows status labels | Each provider in the output has a status label | Text matches `available\|not found\|disabled` |

### `create-server-schema.test.ts`

Verifies config-to-tool-schema fidelity — ensures the tool definitions generated from `providers.json` have correct input schemas, descriptions, and completeness.

| Test | What It Verifies | Expected Output |
|------|-----------------|-----------------|
| Ask tools have `prompt` in inputSchema | Every `ask_*` tool's schema includes `properties.prompt` | `prompt` property is defined for each ask tool |
| Ask tools have standard optional fields | Every per-provider ask tool has `stream_live`, `mode`, `action`, `job_id` fields | All 4 fields present in each tool's schema |
| All tools have non-empty descriptions | Every registered tool has a string description with length > 0 | No tool has an empty or missing description |
| Ping and help exist for every ask provider | Every `ask_<provider>` has a matching `ping_<provider>` and `help_<provider>` | All pairs exist in the tool names set |
| Sessions tools match ask tools | Every `sessions_<provider>` has a corresponding `ask_<provider>` | All session tools have matching ask tools |
| `ask_all` is registered | The global fan-out tool exists | `toolNames` contains `"ask_all"` |
| `list_providers` is registered | The provider listing tool exists | `toolNames` contains `"list_providers"` |
| `provider_metrics` is registered | The metrics tool exists | `toolNames` contains `"provider_metrics"` |

## Unit Tests

1 `.spec.ts` file covering server creation logic and a request ID utility spec.
