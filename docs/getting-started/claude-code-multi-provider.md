# Reuse one Claude Code setup across installed providers

Use this path when you already have one or more local provider CLIs installed and want Claude Code to reach them through one reusable proof-and-compare workflow.

## Pick this path if

- you already work inside Claude Code and want the same provider workflow there
- you do not want to wire a separate MCP entry for each installed provider
- you want setup to end in a real provider answer, not just a config write

## What success looks like

By the end of this path, you will have:

- written the Claude Code MCP entry for `agentic-mcp`
- reloaded Claude Code and confirmed the tools are visible
- completed one real `ask_<provider>` call through the shared workflow

## Prerequisites

- Node.js 22 or newer
- Claude Code installed
- At least one supported provider CLI installed and authenticated
- Permission to restart Claude Code after setup

## Steps

### 1. Write the Claude Code MCP entry

```bash
npx agentic-mcp setup --client claude-code --yes
```

Expected output shape:

- `agentic-mcp setup`
- `What was done:`
- `Detected providers:`
- `What remains unproven:`
- `Next command to prove real use:`

What success means: the Claude Code config entry was written or updated.

What this still does not prove: Claude Code has reloaded the config, and no provider answer has completed yet.

### 2. Restart Claude Code

After setup, restart Claude Code so it reloads MCP configuration.

Expected result:

- tools such as `list_providers`, `ping_<provider>`, and `ask_<provider>` become visible

What success means: Claude Code can now see the same `agentic-mcp` workflow you will use for provider proof, comparison, and follow-on asks.

### 3. Confirm what is detected

In Claude Code, call:

- `list_providers`
- `ping_<provider>` for the provider you want to use first

Expected output shape:

- `list_providers` shows `binary detected`, `binary missing`, or `disabled`
- `ping_<provider>` explains that it only proved binary detection or a version check

What success means: you know which provider should be your first real-answer path.

### 4. Get the first real answer through Claude Code

Call:

- `ask_claude` with prompt `Reply with OK and your provider name.`

Expected output shape:

- a real provider response
- no setup-only or ping-only wording

What success means: Claude Code can now reuse the same proof-and-compare workflow instead of forcing you to wire each provider separately.

## Most likely blocker

### The tools do not appear after setup

Interpretation: Claude Code is still using the old MCP config snapshot.

Next move:

1. Restart Claude Code.
2. Recheck tool visibility.
3. If tools still do not appear, open the configured file and confirm the `agentic-mcp` entry exists.

### The tools appear, but `ask_<provider>` fails

Interpretation: setup worked, but provider authentication or provider-side access is still broken.

Next move:

1. Run the provider CLI directly outside Claude Code.
2. Fix authentication there.
3. Retry the same `ask_<provider>` call inside Claude Code.
