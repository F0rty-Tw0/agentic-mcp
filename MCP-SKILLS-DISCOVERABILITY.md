# MCP Skills Instruction Guide

Use this guide to instruct an AI agent to use the right skills and run `agentic-mcp` through MCP tools or CLI commands.

## Quick Links

- Setup docs: https://github.com/F0rty-Tw0/agentic-mcp/blob/master/README.md#30-second-setup
- CLI docs: https://github.com/F0rty-Tw0/agentic-mcp/blob/master/README.md#cli-usage
- Tool surface reference: https://github.com/F0rty-Tw0/agentic-mcp/blob/master/CLAUDE.md#mcp-tools-exposed
- Repository skill package: https://github.com/F0rty-Tw0/agentic-mcp/blob/master/skills/using-agentic-mcp/SKILL.md

## Optional Skills (If Available)

Not every customer environment has the same skill catalog. Use these as examples, not hard requirements.

- `using-agentic-mcp` (this repository)
  - Use when available to run setup, discovery, execution, and reporting with one repeatable flow.

- `skills-using` (slash alias where configured: `/using-skills`)
  - Use when available to enforce skill-first workflow before action.
- `skills-writing` (slash alias where configured: `/skills-writing`)
  - Use when available for writing or improving skill instructions and discovery docs.
- `test-driven-development`
  - Use when available and code changes are needed after documentation or setup work.

If skills are unavailable, follow the numbered workflow prompts in this document directly.

## Copy-Paste Prompt: Set Up MCP End-to-End

```text
Set up agentic-mcp for me end-to-end and do not stop early.

Execution requirements:
1) If your environment supports skills, load the equivalent of a "using skills" workflow first (for example `using-agentic-mcp`, `skills-using`, or `/using-skills`).
2) Configure MCP client integration with:
   npx agentic-mcp setup --client claude-code --yes
3) Validate provider discovery and readiness:
   - list_providers
   - ping_claude
   - help_claude
4) If any check fails, fix root cause and rerun checks.
5) Return a concise report with configured files, detected providers, and final readiness.
6) Ask if any other providers should be set up too; if yes, configure and verify them the same way.
```

## Copy-Paste Prompt: Use MCP Tools Correctly

```text
Use agentic-mcp through MCP tools for this task.

Requirements:
1) If skills are available, load the environment's "using skills" guidance first (for example `using-agentic-mcp`, `skills-using`, or `/using-skills`).
2) Discover available providers first with list_providers.
3) For each selected provider, run help_<provider> before ask_<provider>.
4) Use ask_<provider> for focused tasks and ask_all only when comparison is needed.
5) Report which tools were called and why.
```

## Copy-Paste Prompt: CLI Fallback Mode

Use this when MCP tool calling is unavailable and you still want the same behaviour.

```text
Use the agentic-mcp CLI directly for this task.

Requirements:
1) If skills are available, load the environment's "using skills" guidance first (for example `using-agentic-mcp`, `skills-using`, or `/using-skills`).
2) Start by checking commands from README CLI usage.
3) Run list_providers first.
4) Then run provider checks (for example ping_claude) before asks.
5) Use ask_<provider> for single-provider tasks, or ask_all for cross-provider comparison.
6) Report executed commands and final outcome.
```

## Skill Authoring Notes for This Repo

When updating skill instructions in this project:

1. Start descriptions with `Use when...`.
2. Keep descriptions about trigger conditions, not workflow summaries.
3. Include MCP and CLI discovery terms (`list_providers`, `help_<provider>`, `ask_<provider>`).
4. Keep prompts copy-paste ready.

## Validation Checklist

- Ask a fresh agent to set up from the first prompt.
- Confirm it loads skill guidance before executing commands.
- Confirm it discovers providers with `list_providers` before asking.
- Confirm it asks whether more providers should be configured.
