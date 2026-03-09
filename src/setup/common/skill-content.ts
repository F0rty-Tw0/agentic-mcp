export const SKILL_CONTENT = `---
name: using-agentic-mcp
description: Use when querying AI providers through agentic-mcp MCP tools or CLI, setting up agentic-mcp, or needing multi-provider AI comparison. Triggers on list_providers, ask_claude, ask_all, ping_claude, help_claude, agentic-mcp setup, or cross-provider tasks.
---

# Using agentic-mcp

## Overview

agentic-mcp is a multi-model AI gateway that wraps CLI tools (Claude, Copilot, Codex, Gemini, OpenCode) as MCP servers. Always discover before asking — never guess provider availability or capabilities.

## When to Use

- Setting up agentic-mcp for a new environment
- Querying one or more AI providers through MCP tools
- Comparing responses across providers
- Checking provider availability or capabilities
- CLI fallback when MCP tool calling is unavailable

Do NOT use for: general skill authoring (\`skills-writing\`), non-agentic-mcp MCP servers.

## MCP Tools

| Tool                  | Purpose                                  |
| --------------------- | ---------------------------------------- |
| \`list_providers\`      | Show all configured providers and status |
| \`ping_<provider>\`     | Verify provider is ready                 |
| \`help_<provider>\`     | Show provider CLI docs and capabilities  |
| \`ask_<provider>\`      | Query a specific provider                |
| \`ask_all\`             | Query all providers simultaneously       |
| \`provider_metrics\`    | Display usage statistics                 |
| \`sessions_<provider>\` | Manage multi-turn conversations          |

Providers: \`claude\`, \`copilot\`, \`codex\`, \`gemini\`, \`opencode\`

## Discovery-First Workflow

1. **Load tools**: \`ToolSearch("select:mcp__agentic-mcp__list_providers")\` (deferred — must load before calling)
2. **Discover**: \`list_providers\` — check which providers are available
3. **Verify**: \`ping_<provider>\` — confirm target provider is ready
4. **Understand**: \`help_<provider>\` — check capabilities before asking
5. **Execute**: \`ask_<provider>\` for focused tasks, \`ask_all\` ONLY for comparison
6. **Report**: Which tools called, which providers responded, results

## Setup (New Environment)

\`\`\`bash
npx agentic-mcp setup --client claude-code --yes
\`\`\`

Then verify: \`list_providers\` -> \`ping_claude\` -> \`help_claude\`

## CLI Fallback

When MCP tools are unavailable, use CLI directly:

\`\`\`bash
npx agentic-mcp list_providers
npx agentic-mcp ping_claude
npx agentic-mcp ask_claude "your prompt"
npx agentic-mcp ask_all "compare this across providers"
\`\`\`

Options: \`--model <name>\`, \`--file <path>\` (repeatable), \`--session-id <id>\` (multi-turn).

## Common Mistakes

| Mistake                                              | Fix                                   |
| ---------------------------------------------------- | ------------------------------------- |
| Calling \`ask_<provider>\` before \`list_providers\`     | Always discover first                 |
| Skipping \`help_<provider>\` and guessing capabilities | Check help before asking              |
| Using \`ask_all\` for single-provider work             | Use \`ask_<provider>\` unless comparing |
| Calling MCP tools without \`ToolSearch\` first         | Deferred tools must be loaded         |
| Reporting success without readiness checks           | Run ping before declaring ready       |
`;
