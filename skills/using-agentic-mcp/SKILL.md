---
name: using-agentic-mcp
description: Use when an AI agent needs a repeatable workflow to discover providers and run agentic-mcp through MCP tools or CLI, with setup checks and fallback steps.
---

# Using agentic-mcp

## Overview

Use this skill to run `agentic-mcp` with a discovery-first flow. Start by discovering providers, verify readiness, then execute focused asks.

## When to Use

- You need to configure `agentic-mcp` for a customer environment.
- You need reliable MCP tool invocation order (`list_providers`, `help_<provider>`, `ask_<provider>`).
- MCP tool calling is unavailable and you need CLI fallback with the same workflow.

Do not use this for general skill authoring. Use `skills-writing` for that.

## Core Workflow

1. If the environment supports skills, load its "using skills" guidance first.
2. Run setup:
   - `npx agentic-mcp setup --client claude-code --yes`
3. Discover and verify providers:
   - `list_providers`
   - `ping_<provider>`
   - `help_<provider>`
4. Execute work:
   - use `ask_<provider>` for focused tasks
   - use `ask_all` only for comparison tasks
5. If MCP calls are unavailable, use CLI with the same sequence.
6. Report configured files, detected providers, readiness, and whether additional providers should be set up.

## Prompt Templates

### Setup Prompt

```text
Set up agentic-mcp for me end-to-end and do not stop early.

Execution requirements:
1) If your environment supports skills, load the equivalent of a "using skills" workflow first.
2) Configure MCP client integration with: npx agentic-mcp setup --client claude-code --yes
3) Validate provider discovery and readiness: list_providers, ping_claude, help_claude
4) If any check fails, fix root cause and rerun checks.
5) Return a concise report with configured files, detected providers, and final readiness.
6) Ask if any other providers should be set up too; if yes, configure and verify them the same way.
```

### MCP Execution Prompt

```text
Use agentic-mcp through MCP tools for this task.

Requirements:
1) Discover providers first with list_providers.
2) For each selected provider, run help_<provider> before ask_<provider>.
3) Use ask_<provider> for focused tasks and ask_all only when comparison is needed.
4) Report which tools were called and why.
```

### CLI Fallback Prompt

```text
Use the agentic-mcp CLI directly for this task.

Requirements:
1) Start by checking available commands.
2) Run list_providers first.
3) Run provider checks (for example ping_claude) before asks.
4) Use ask_<provider> for single-provider tasks, or ask_all for cross-provider comparison.
5) Report executed commands and final outcome.
```

## Validation Checklist

- The agent discovers providers before asking.
- The agent checks provider readiness before execution.
- The agent uses `ask_all` only when comparison is requested.
- The final report includes provider status and setup outcomes.
- The agent asks whether more providers should be configured.

## Common Mistakes

- Calling `ask_<provider>` before `list_providers`.
- Skipping `help_<provider>` and guessing capabilities.
- Using `ask_all` for normal single-provider work.
- Reporting success without readiness checks.

## References

- https://github.com/F0rty-Tw0/agentic-mcp/blob/master/README.md
- https://github.com/F0rty-Tw0/agentic-mcp/blob/master/MCP-SKILLS-DISCOVERABILITY.md
- https://github.com/F0rty-Tw0/agentic-mcp/blob/master/CLAUDE.md
