# server

MCP server factory — creates and configures the Model Context Protocol server instance with all registered tools and transport handling.

## What It Does

- Loads provider configuration and resolves which CLI binaries are detected on the system
- Creates an `McpServer` instance with the application name and version
- Registers all MCP tools (per-provider ask/ping/help/sessions + global ask_all/list_providers/provider_metrics)
- Leaves MCP `notifications/cancelled` to the SDK, which aborts the request's `extra.signal`: a queued call leaves the provider queue without spawning, a running CLI is killed, and no response is sent
- Connects to stdio transport for communication with MCP clients

## Structure

| Directory       | Purpose                                            |
| --------------- | -------------------------------------------------- |
| `common/`       | Server name constant, no-providers warning message |
| `domain-logic/` | Server creation and wiring                         |

## Key Files

- `domain-logic/create-server.ts` — `createServer()` — loads config, resolves providers, creates McpServer, registers tools
- `common/server.constants.ts` — `SERVER_NAME` and `NO_PROVIDERS_WARNING`

## Integration Tests

Run with: `pnpm run test:integration`

### `create-server.test.ts`

Exercises the full MCP server wiring end-to-end using `InMemoryTransport` (no network, no Docker). A real server and client are connected in `beforeAll` and torn down in `afterAll`.

| Test                                   | What It Verifies                                                                                          | Expected Output                                                                              |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Tool listing includes `list_providers` | The global `list_providers` tool is registered                                                            | `toolNames` contains `"list_providers"`                                                      |
| Per-provider tool completeness         | Every `ask_<provider>` tool has a matching `ping_<provider>` and `help_<provider>`                        | All provider triples are present                                                             |
| Every tool has a description           | No tool is registered without a description string                                                        | `tool.description` is truthy for all tools                                                   |
| Ping returns limited proof scope       | Calling `ping_<provider>` for a detected provider returns wording that stays explicit about limited proof | Response text contains the provider name plus `binary detected` or `version check succeeded` |
| Help returns non-empty text            | Calling `help_<provider>` returns meaningful help content                                                 | Response text length > 0                                                                     |
| list_providers returns provider status | Calling `list_providers` returns text mentioning at least one known provider                              | Text matches provider name pattern                                                           |
| list_providers shows truthful labels   | Each provider in the output has a truthful status label                                                   | Text matches `binary detected\|binary missing\|disabled`                                     |

### `create-server-cancellation.test.ts`

Starts a server from a temporary `providers.json` whose only provider is a Node script that logs each spawn and then sleeps (`maxConcurrency: 1`). The client cancels calls with an `AbortSignal`.

| Test                  | What It Verifies                                                         | Expected Output                                                       |
| --------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Cancel a queued call  | A call cancelled while it waits for the provider slot never runs the CLI | Spawn log holds only the first call; no response for the cancelled id |
| Cancel a running call | A running call's CLI is killed and the server sends no response          | Logged pid is gone; no response for the cancelled id                  |

### `create-server-schema.test.ts`

Verifies config-to-tool-schema fidelity — ensures the tool definitions generated from `providers.json` have correct input schemas, descriptions, and completeness.

| Test                                       | What It Verifies                                                                 | Expected Output                                |
| ------------------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------- |
| Ask tools have `prompt` in inputSchema     | Every `ask_*` tool's schema includes `properties.prompt`                         | `prompt` property is defined for each ask tool |
| Ask tools have standard optional fields    | Every per-provider ask tool has `stream_live`, `mode`, `action`, `job_id` fields | All 4 fields present in each tool's schema     |
| All tools have non-empty descriptions      | Every registered tool has a string description with length > 0                   | No tool has an empty or missing description    |
| Ping and help exist for every ask provider | Every `ask_<provider>` has a matching `ping_<provider>` and `help_<provider>`    | All pairs exist in the tool names set          |
| Sessions tools match ask tools             | Every `sessions_<provider>` has a corresponding `ask_<provider>`                 | All session tools have matching ask tools      |
| `ask_all` is registered                    | The global fan-out tool exists                                                   | `toolNames` contains `"ask_all"`               |
| `list_providers` is registered             | The provider listing tool exists                                                 | `toolNames` contains `"list_providers"`        |
| `provider_metrics` is registered           | The metrics tool exists                                                          | `toolNames` contains `"provider_metrics"`      |

## Unit Tests

`.spec.ts` files covering server creation logic and dangerous-flag warnings.
