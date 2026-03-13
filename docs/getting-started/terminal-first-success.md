# Get your first real answer from the terminal

Use this path when you want proof that `agentic-mcp` can do real work before you spend time on MCP client setup.

## Pick this path if

- you already installed one provider CLI and want to know whether it can answer through `agentic-mcp`
- you want the fastest route to a first working result
- you do not want to configure an editor or agent client yet

## What success looks like

By the end of this path, you will have:

- detected the provider CLIs available on this machine
- chosen the best first provider to prove
- completed one real proof run through `agentic-mcp`

This path does not require MCP client setup.

## Prerequisites

- Node.js 22 or newer
- One supported provider CLI installed locally
- That provider CLI already authenticated

## Steps

### 1. Run minimal onboarding

```bash
npx agentic-mcp init
```

Expected output shape:

- `agentic-mcp init`
- `Detected providers:`
- `What remains unproven:`
- `Next step:`

What success means: the package runs locally and can detect provider binaries.

### 2. See what is detected

```bash
npx agentic-mcp list_providers
```

Expected output shape:

- provider lines marked `binary detected`, `binary missing`, or `disabled`
- a `Next:` line that points to the first real proof step

What success means: you know which provider should be your first real-answer candidate.

### 3. Get the first real answer

```bash
npx agentic-mcp prove
```

Use `npx agentic-mcp prove codex` if you want to force a specific detected provider.

Expected output shape:

- a short prove message naming the selected provider
- a normal provider response in stdout
- no fallback wording about detection-only checks

What success means: you have now routed a real prompt through `agentic-mcp` and the selected provider can do useful work from the terminal.

### 4. Optional: run the limited ping check

```bash
npx agentic-mcp ping_claude
```

Replace `claude` with the detected provider you actually installed.

Expected output shape:

- `binary detected at ...` or `version check succeeded ...`
- a reminder to run `prove` or `ask_<provider>` for real proof

What success means: the binary is present and the limited check works.

What this still does not prove: authentication and a successful provider response.

## Most likely blocker

### `list_providers` shows `binary missing`

Interpretation: the provider CLI is not installed or is not on `PATH`.

Next move:

1. Install the provider CLI.
2. Authenticate it directly.
3. Rerun `npx agentic-mcp list_providers`.

### `ping_<provider>` works but `prove` fails

Interpretation: the binary exists, but authentication or provider-side access is still broken.

Next move:

1. Run the provider CLI directly and confirm it can answer.
2. Fix authentication there.
3. Retry `npx agentic-mcp prove` or `npx agentic-mcp ask_<provider> ...`.
