# MCP Skills Instruction Guide

Use this guide when you want an AI agent to get to a real provider answer quickly, compare providers on the same prompt, or configure one MCP client entry instead of wiring each provider separately. It explains how to drive `agentic-mcp` toward user outcomes through MCP tools or CLI commands.

## Quick Links

- Setup docs: https://github.com/F0rty-Tw0/agentic-mcp/blob/master/README.md#quickstart
- Terminal-first scenario: https://github.com/F0rty-Tw0/agentic-mcp/blob/master/docs/getting-started/terminal-first-success.md
- Claude Code scenario: https://github.com/F0rty-Tw0/agentic-mcp/blob/master/docs/getting-started/claude-code-multi-provider.md
- Provider comparison scenario: https://github.com/F0rty-Tw0/agentic-mcp/blob/master/docs/getting-started/compare-two-providers.md
- CLI docs: https://github.com/F0rty-Tw0/agentic-mcp/blob/master/README.md#cli-usage
- Tool surface reference: https://github.com/F0rty-Tw0/agentic-mcp/blob/master/CLAUDE.md#mcp-tools-exposed
- Repository skill package: https://github.com/F0rty-Tw0/agentic-mcp/blob/master/skills/using-agentic-mcp/SKILL.md

## Optional Skills (If Available)

Not every customer environment has the same skill catalog. Use these as examples, not hard requirements.

- `using-agentic-mcp` (this repository)
  - Use when available to drive setup, discovery, first successful asks, and provider comparison through one repeatable flow.

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
3) Validate discovery and limited-proof checks:
   - list_providers
   - ping_claude
4) Prove real usage with:
   - ask_claude "Reply with OK and your provider name."
5) Use help_claude only if you need capabilities or CLI details.
6) If any check fails, fix root cause and rerun checks.
7) Return a concise report with configured files, detected providers, what remains unproven, and whether the real ask succeeded.
8) Ask if any other providers should be set up too; if yes, configure and verify them the same way.
```

## Copy-Paste Prompt: Use MCP Tools Correctly

```text
Use agentic-mcp through MCP tools for this task.

Requirements:
1) If skills are available, load the environment's "using skills" guidance first (for example `using-agentic-mcp`, `skills-using`, or `/using-skills`).
2) Discover available providers first with list_providers.
3) Run ping_<provider> before the first ask so you know what was actually checked.
4) Use ask_<provider> before claiming a provider is usable for real work.
5) Use help_<provider> only when you need capability details.
6) Use ask_all only when comparison is needed.
7) Report which tools were called, what they proved, and what is still unproven.
```

## Copy-Paste Prompt: CLI Fallback Mode

Use this when MCP tool calling is unavailable and you still want the same behaviour.

```text
Use the agentic-mcp CLI directly for this task.

Requirements:
1) If skills are available, load the environment's "using skills" guidance first (for example `using-agentic-mcp`, `skills-using`, or `/using-skills`).
2) Start by checking commands from README CLI usage.
3) Run list_providers first.
4) Then run provider checks (for example ping_claude) before the first ask.
5) Use ask_<provider> for the first real answer, or ask_all for cross-provider comparison.
6) Use help_<provider> only when you need capability details.
7) Report executed commands, what they proved, and the final outcome.
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
- Confirm it reaches a real `ask_<provider>` before claiming success.
- Confirm it asks whether more providers should be configured.
