---
name: using-agentic-mcp
description: Use when an AI agent needs a repeatable workflow to get a real answer or compare providers through agentic-mcp, with discovery, proof, and CLI fallback steps.
---

# Using agentic-mcp

## Overview

Use this skill when the goal is a working outcome: get a real answer from the provider already installed on the machine, compare multiple providers on one prompt, or configure one MCP client entry instead of wiring providers separately. Start by discovering providers, prove one provider works with `ask_<provider>`, then use `ask_all` only for deliberate comparison.

## When to Use

- You need to get to a first successful provider answer through `agentic-mcp`.
- You need to compare multiple providers on the same prompt without bespoke glue.
- You need one repeatable workflow for MCP tools and CLI fallback.

Do not use this for general skill authoring. Use `skills-writing` for that.

## Core Workflow

1. If the environment supports skills, load its "using skills" guidance first.
2. Run setup or minimal onboarding:
   - `npx agentic-mcp setup --client claude-code --yes`
   - or `npx agentic-mcp init` if you want skill-first onboarding before writing MCP config
3. Discover what is detected:
   - `list_providers`
   - `ping_<provider>`
   - `help_<provider>` only when you need capabilities or CLI details
4. Prove real usage before claiming readiness:
   - use `ask_<provider>` to get the first real answer
5. Compare providers deliberately:
   - use `ask_all` only when comparison itself is the goal
6. If MCP calls are unavailable, use CLI with the same sequence.
7. Report configured files, detected providers, what remains unproven, and whether a real ask succeeded.

## Prompt Templates

### Setup Prompt

```text
Set up agentic-mcp for me end-to-end and do not stop early.

Execution requirements:
1) If your environment supports skills, load the equivalent of a "using skills" workflow first.
2) Configure MCP client integration with: npx agentic-mcp setup --client claude-code --yes
3) Validate discovery and limited-proof checks: list_providers, ping_claude
4) Prove real usage with: ask_claude "Reply with OK and your provider name."
5) Use help_claude only if you need capabilities or CLI details.
6) If any check fails, fix root cause and rerun checks.
7) Return a concise report with configured files, detected providers, what remains unproven, and whether the real ask succeeded.
8) Ask if any other providers should be set up too; if yes, configure and verify them the same way.
```

### MCP Execution Prompt

```text
Use agentic-mcp through MCP tools for this task.

Requirements:
1) Discover providers first with list_providers.
2) Run ping_<provider> before the first ask so you know what was actually checked.
3) Use ask_<provider> before claiming a provider is usable for real work.
4) Use help_<provider> only when you need capability details.
5) Use ask_all only when comparison is needed.
6) Report which tools were called, what they proved, and what is still unproven.
```

### CLI Fallback Prompt

```text
Use the agentic-mcp CLI directly for this task.

Requirements:
1) Start by checking available commands.
2) Run list_providers first.
3) Run provider checks (for example ping_claude) before the first ask.
4) Use ask_<provider> for the first real answer, or ask_all for deliberate comparison.
5) Use help_<provider> only when you need capability details.
6) Report executed commands, what they proved, and the final outcome.
```

## Validation Checklist

- The agent discovers providers before asking.
- The agent gets to a real `ask_<provider>` result before calling a provider usable for real work.
- The agent uses `ask_all` only when comparison is requested.
- The final report includes what setup changed, what remains unproven, and whether a real ask succeeded.
- The agent asks whether more providers should be configured.

## Common Mistakes

- Calling `ask_<provider>` before `list_providers`.
- Treating `ping_<provider>` as proof of authentication or end-to-end readiness.
- Using `help_<provider>` instead of a real ask to claim success.
- Using `ask_all` for normal single-provider work.
- Reporting success after setup or ping without a real ask.

## References

- https://github.com/F0rty-Tw0/agentic-mcp/blob/master/README.md
- https://github.com/F0rty-Tw0/agentic-mcp/blob/master/docs/getting-started/terminal-first-success.md
- https://github.com/F0rty-Tw0/agentic-mcp/blob/master/docs/getting-started/claude-code-multi-provider.md
- https://github.com/F0rty-Tw0/agentic-mcp/blob/master/docs/getting-started/compare-two-providers.md
- https://github.com/F0rty-Tw0/agentic-mcp/blob/master/MCP-SKILLS-DISCOVERABILITY.md
- https://github.com/F0rty-Tw0/agentic-mcp/blob/master/CLAUDE.md
