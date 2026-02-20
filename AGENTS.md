# AGENTS.md — Coding Style Guide

This file contains the coding conventions, style rules, and development practices for the agentic-mcp codebase. It is automatically loaded by Claude Code agents working in this repository.

## Code Style

- TypeScript strict mode (see tsconfig decisions in CLAUDE.md)
- No enums, no namespaces (`erasableSyntaxOnly`)
- 2-space indent, LF line endings, UTF-8 (see `.editorconfig`)
- Line endings normalised to LF via `.gitattributes`
- Keep shared constants/types/errors under `src/common/` using specific files (avoid catch-all `types.ts`)
- Guard-first control flow: prefer early returns/continues over nested blocks.
- Avoid lone `if` wrappers and `if/else` pairs when a guard clause can flatten the flow without changing behavior.
- Require explicit types on exported APIs and non-trivial helpers (parameters and return types).
- Keep changes minimal, behavior-preserving, and clean (small functions, clear names, no dead branches).
- **Optional chaining for nullable length checks** — prefer `x?.length > 0` (or just `x?.length` when truthy is sufficient) over `x && x.length > 0`. More concise, same semantics.
- **Truthy/falsy over explicit boolean comparison** — prefer `if (flag)` over `if (flag === true)` and `if (!flag)` over `if (flag === false)`. Explicit comparison is redundant when the type is already `boolean | undefined`.
- **Named return variables** — assign complex return values to a typed variable before returning (`const result: Type = { ... }; return result;`), rather than returning an object literal directly. Aids debuggability and makes the return type explicit at the construction site.
- **No magic numbers** — numeric thresholds, limits, and capacities belong in `src/common/` constants files (e.g. `execution-limits.const.ts`), not inline in business logic. Name them descriptively.
- **Deep `Readonly`** — when wrapping a type in `Readonly<>`, also wrap nested `Record<>` and object fields (e.g. `env: Readonly<Record<string, string>>`). Shallow `Readonly` on the outer type does not protect inner structures from mutation.
- **Consistent error-path checking** — every handler that calls `executeCommand` must check `result.exitCode`, `result.signal`, and `result.timedOut` before treating the result as a success. Never silently ignore non-zero exit codes.
- **Promises must resolve on all paths** — every `new Promise` constructor must resolve or reject on every code path. Avoid patterns where a Promise only resolves inside a timer or conditional branch while other paths leave it dangling.
- **No dead exports** — remove unused exports promptly rather than leaving them for "future use". Dead code increases cognitive load and maintenance burden. If it's needed later, add it back with a test.
- **Boundary data preservation** — when truncating streams or buffers to a size limit, always capture the partial data up to the boundary (e.g. `chunk.subarray(0, remaining)`). Never discard an entire chunk that partially fits.
- **Type-safe `.includes()`** — avoid `value as NarrowType` casts to satisfy `.includes()`. Instead, widen the array: `(ARRAY as readonly string[]).includes(value)`.
- **Reduce mechanical duplication** — when 3+ functions share the same structure with only a parameter differing, extract a generic helper. Keep specialized variants only when their logic genuinely differs.

## Testing Style

Use GIVEN/WHEN/THEN phrasing for test cases to make intent explicit.

- **GIVEN** the initial context/setup
- **WHEN** the behaviour under test is executed
- **THEN** the expected outcome is asserted

Example naming pattern: `GIVEN X WHEN Y THEN Z`.

## TDD Enforcement (Mandatory)

- **No production code before a failing test** for feature work, bug fixes, and behavior refactors.
- Follow strict **Red -> Green -> Refactor**: write failing test, verify failure reason, implement minimal fix, then refactor.
- If implementation code is written before the test, delete it and restart from a failing test.
- Run the focused test during red/green, then run the full relevant suite before completion.

## Functional Programming Preference

Prefer functions over classes throughout the codebase:

- **Default to `const` function expressions** — write functions as `const name = (...) => {}` (or async equivalent). Use `function` syntax only when a real `this` context is required.
- **Default to plain functions** — export standalone functions, not class methods. Use closures for encapsulation when needed.
- **Pure functions first** — functions should be deterministic with no side effects where possible. Side effects (I/O, spawn, fs) belong at the edges, not buried in logic.
- **Data as plain objects** — pass data using plain objects and TypeScript interfaces/types, not class instances. Avoid `new` for domain data.
- **Composition over inheritance** — combine small functions via composition (`pipe`, higher-order functions) instead of class hierarchies.
- **Exceptions: error classes** — custom error classes (`extends Error`) are the one accepted use of classes. They need `instanceof` checks and proper stack traces, which plain objects can't provide.
- **No `this` in domain logic** — if you're reaching for `this`, restructure as a function that takes its dependencies as arguments.

## Readonly by Default

Mark types as immutable unless mutation is required:

- **Wrap type aliases with `Readonly<>`** — all `type` definitions for objects that are not mutated after creation should use `Readonly<{...}>`. This prevents accidental property reassignment.
- **Use `readonly` for array fields** — array properties that are not mutated should use `readonly string[]` (or `readonly T[]`) instead of `string[]`. This prevents accidental `.push()`, `.splice()`, etc.
- **Zod-inferred types are exempt** — types derived from `z.infer<>` are left as-is since making them deeply readonly requires `DeepReadonly` utility types. These types are treated as read-only by convention after parsing.
- **Mutable locals are fine** — local variables that are built incrementally (e.g. `const arr: string[] = []; arr.push(...)`) don't need `readonly`. The constraint applies to type definitions and function signatures, not to local construction patterns.

## Defensive Value Checks

- **Null checks for config/schema values** — when checking if a config value is present, prefer `value == null` over `!value` to avoid swallowing falsy-but-valid values like `""` or `0`. Use `!value` only when all falsy values (empty string, false, zero) should genuinely be skipped (e.g., user-provided optional args where empty/false means "not provided").
- **Validate constrained values at point of use** — when a schema defines allowed values (e.g., a leveled flag with a `values` array), validate inputs against them where the value is consumed, not only at schema parse time. Runtime validation catches mismatches that schema validation can't (e.g., user-provided tool arguments matched against config-defined constraints).
- **Custom error classes over plain `Error`** — throw `ValidationError` for input/config validation failures, `CommandExecutionError` for execution failures. Never throw bare `Error` — custom classes enable consistent MCP error responses via `toMcpResponse()`.
- **Fail loud over silent drops** — when a code path encounters an unsupported variant (e.g., a flag type that can't be handled for file args), throw an explicit error rather than silently skipping. Silent drops hide config mistakes and make debugging harder.

## Linter Validation

Run the linter continuously during development. Every change must pass before it is considered complete.

- **After every code change**, run `pnpm run lint` to verify compliance.
- **Before any commit**, ensure `pnpm run lint` exits cleanly (zero errors, zero warnings).
- **Use `pnpm run lint:fix`** for auto-fixable issues, but always review the diff — don't blindly accept auto-fixes.
- **Never suppress lint rules** (`eslint-disable`) without documenting why in a comment. Suppression is a last resort, not a shortcut.
