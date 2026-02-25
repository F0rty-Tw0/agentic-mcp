# cli-args

Translates abstract MCP tool arguments (`AskToolArgs`) into a concrete CLI argument array (`BuiltArgs`) using a provider's declarative configuration (`ProviderConfig`).

## What it does

Given a provider config and tool input, `buildArgArray` produces the exact `string[]` (plus optional stdin) needed to spawn the provider's CLI process.

### Argument ordering

```
[command args] → [prompt] → [optional flags] → [trailing args]
```

### Prompt delivery

The prompt is delivered based on `config.input.method`:

| Method       | Behavior                                    |
|-------------|---------------------------------------------|
| `positional` | Prompt appended as a positional argument     |
| `flag`       | Prompt follows the flag prefix from `args`   |
| `stdin`      | Prompt sent via `stdinInput`, not in args    |

### Flag types

Flags in `ProviderConfig` come in three shapes, resolved by `resolveFlagToArgs`:

| Shape                                      | Example config                                      | Output                        |
|-------------------------------------------|-----------------------------------------------------|-------------------------------|
| `string` — simple key-value flag           | `"--model"`                                         | `["--model", "gpt-4"]`        |
| `string[]` — boolean toggle (all-or-nothing) | `["--full-auto"]`                                  | `["--full-auto"]`             |
| `LeveledFlag` — enum with allowed values   | `{ flag: "--sandbox", values: ["read-only", "full"] }` | `["--sandbox", "read-only"]` |

### Supported optional flags

`model`, `working_directory`, `files`, `auto_mode`, `sandbox`, `effort`, `max_budget`, `system_prompt`

Flags missing from the provider config are silently skipped.

## Public API

```ts
buildArgArray(config: ProviderConfig, args: AskToolArgs): BuiltArgs
```

## Validation

- Throws `ValidationError` if prompt is missing or empty
- Throws `ValidationError` if a `LeveledFlag` receives a value not in its allowed list
- Throws `ValidationError` if the `file` flag is not a simple string type
