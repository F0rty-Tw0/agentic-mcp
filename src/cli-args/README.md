# cli-args

Declarative CLI argument builder — converts ask tool arguments into CLI string arrays for provider command execution.

## What It Does

- Takes `AskToolArgs` (prompt, flags, model, etc.) and the provider's command config
- Produces a `string[]` suitable for passing to `cross-spawn` as child process arguments
- Handles flag resolution (boolean flags, key-value flags, leveled flags with allowed values)
- Supports file arguments (`--file` repeated per file), sandbox mode flags, and stdin delivery
- Respects the provider's `input.method` setting (`positional` vs `stdin`) for prompt delivery
- Appends optional flags: model, working directory, auto mode, sandbox, effort, max budget, system prompt

## Structure

| Directory       | Purpose          |
| --------------- | ---------------- |
| `domain-logic/` | Argument builder |

## Key Files

- `domain-logic/arg.builder.ts` — `buildArgArray()` — converts tool args + provider config into a `BuiltArgs` object containing the CLI args array and optional stdin input

## Integration Tests

None. This module is a pure data transformation (args in, string array out) with no I/O or side effects. Full coverage is achieved through unit tests. The arg builder is exercised indirectly through `ask/` integration tests when real provider commands are spawned.

## Unit Tests

1 `.spec.ts` file covering flag resolution, positional vs stdin modes, sandbox flags, file arguments, leveled flag validation, and edge cases.
