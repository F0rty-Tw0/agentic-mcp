# Compare two providers on the same prompt

Use this path when the value is in the contrast: quality, latency, or failure behavior across two installed providers.

## Pick this path if

- you already have two providers installed and want to compare them on one task
- you want to see concrete differences instead of guessing which provider is better
- comparison itself is the reason you are here

## What success looks like

By the end of this path, you will have:

- confirmed both provider CLIs are available
- proved each provider can answer on its own
- captured one side-by-side comparison through `ask_all`

This path is only worth it when comparison itself is the goal.

## Prerequisites

- Node.js 22 or newer
- Two supported provider CLIs installed locally
- Both CLIs authenticated
- Both providers visible as `binary detected` in `list_providers`

## Steps

### 1. Confirm both providers are detected

```bash
npx agentic-mcp list_providers
```

Expected output shape:

- both target providers appear as `binary detected`
- the output does not claim readiness without a real ask

What success means: both binaries are present, selectable, and worth taking to the first proof step.

### 2. Prove each provider can answer on its own

```bash
npx agentic-mcp ask_claude "Reply with one sentence about why consistency matters."
npx agentic-mcp ask_codex "Reply with one sentence about why consistency matters."
```

Replace the provider names with the pair you actually installed.

What success means: each provider can complete a real single-provider ask before you compare them together.

### 3. Run the side-by-side comparison

```bash
npx agentic-mcp ask_all "Reply with one sentence about why consistency matters." --providers claude,codex --report ./reports/consistency.json
```

Expected output shape:

- one structured result containing both providers
- per-provider success or failure data
- response text grouped by provider
- an optional JSON report file when `--report <path>` is provided

What success means: you can compare providers through one interface instead of hand-running the same prompt multiple times, the contrast is now concrete rather than theoretical, and the result can be reused later if you save a report artifact.

## When not to use `ask_all`

Do not use it for routine single-provider work. `ask_all` costs more, produces more output, and is only worth it when comparison itself is the goal.

## Most likely blocker

### One provider works alone, but `ask_all` shows a failure for the other

Interpretation: the second provider is still misconfigured, unauthenticated, or using a shared model it cannot satisfy.

Next move:

1. Retry that provider with `ask_<provider>` by itself.
2. Fix the provider-specific issue.
3. Rerun `ask_all` only after both single-provider asks work.
