# using-agentic-mcp

Reusable skill for running `agentic-mcp` with a discovery-first workflow across MCP tools and CLI fallback.

## What It Does

| Capability         | Description                                                                    |
| ------------------ | ------------------------------------------------------------------------------ |
| Provider discovery | Uses `list_providers` before execution                                         |
| Readiness checks   | Verifies with `ping_<provider>` and `help_<provider>`                          |
| Execution routing  | Uses `ask_<provider>` for focused asks and `ask_all` for comparison            |
| Setup workflow     | Runs `npx agentic-mcp setup --client claude-code --yes` and validates outcomes |
| Fallback mode      | Uses CLI path when MCP tool calling is unavailable                             |

---

## When to Use

Use this skill when you:

- Need to set up `agentic-mcp` in a new environment.
- Need a reliable MCP tool invocation order.
- Need copy-paste prompts for MCP and CLI usage.
- Need an agent to verify readiness before reporting success.

---
