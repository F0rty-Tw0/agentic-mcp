# AGENTS.md — Coding Style Guide

This file contains the coding conventions, style rules, and development practices for the agentic-mcp codebase. It is automatically loaded by Claude Code agents working in this repository.

## Code Style

- TypeScript strict mode (see tsconfig decisions in CLAUDE.md)
- No enums, no namespaces (`erasableSyntaxOnly`)
- 2-space indent, LF line endings, UTF-8 (see `.editorconfig`)
- Line endings normalised to LF via `.gitattributes`
- Keep shared constants/types/errors under `src/shared/` using specific files (avoid catch-all `types.ts`)
- Guard-first control flow: prefer early returns/continues over nested blocks.
- Avoid lone `if` wrappers and `if/else` pairs when a guard clause can flatten the flow without changing behavior.
- Require explicit types on exported APIs and non-trivial helpers (parameters and return types).
- Keep changes minimal, behavior-preserving, and clean (small functions, clear names, no dead branches).
- **Optional chaining for nullable length checks** — prefer `x?.length > 0` (or just `x?.length` when truthy is sufficient) over `x && x.length > 0`. More concise, same semantics.
- **Truthy/falsy over explicit boolean comparison** — prefer `if (flag)` over `if (flag === true)` and `if (!flag)` over `if (flag === false)`. Explicit comparison is redundant when the type is already `boolean | undefined`.
- **Named return variables** — assign complex return values to a typed variable before returning (`const result: Type = { ... }; return result;`), rather than returning an object literal directly. Aids debuggability and makes the return type explicit at the construction site.
- **No magic numbers** — numeric thresholds, limits, and capacities belong in `src/shared/` constants files (e.g. `execution-limits.const.ts`), not inline in business logic. Name them descriptively.
- **Deep `Readonly`** — when wrapping a type in `Readonly<>`, also wrap nested `Record<>` and object fields (e.g. `env: Readonly<Record<string, string>>`). Shallow `Readonly` on the outer type does not protect inner structures from mutation.
- **Consistent error-path checking** — every handler that calls `executeCommand` must check `result.exitCode`, `result.signal`, and `result.timedOut` before treating the result as a success. Never silently ignore non-zero exit codes.
- **Promises must resolve on all paths** — every `new Promise` constructor must resolve or reject on every code path. Avoid patterns where a Promise only resolves inside a timer or conditional branch while other paths leave it dangling.
- **No dead exports** — remove unused exports promptly rather than leaving them for "future use". Dead code increases cognitive load and maintenance burden. If it's needed later, add it back with a test.
- **Boundary data preservation** — when truncating streams or buffers to a size limit, always capture the partial data up to the boundary (e.g. `chunk.subarray(0, remaining)`). Never discard an entire chunk that partially fits.
- **Type-safe `.includes()`** — avoid `value as NarrowType` casts to satisfy `.includes()`. Instead, widen the array: `(ARRAY as readonly string[]).includes(value)`.
- **Reduce mechanical duplication** — when 3+ functions share the same structure with only a parameter differing, extract a generic helper. Keep specialized variants only when their logic genuinely differs.

## Imports & Exports

- **Import group order** — Node stdlib → external packages → internal modules, with a blank line between each group. Within a group, multi-symbol imports are destructured in a single statement.
- **`node:` protocol prefix mandatory** — always `import from 'node:fs/promises'`, never bare `'fs/promises'`. Applies to all Node stdlib modules (`node:path`, `node:process`, `node:url`, `node:child_process`, `node:os`, `node:stream`, `node:util`).
- **`import type` for type-only imports** — enforced by `verbatimModuleSyntax`. Never mix value and type imports in one statement when only the type is used.
- **No default exports** — all exports are named, inline on the declaration (`export const`, `export type`, `export class`). No `export default` anywhere.
- **No barrel files** — no `index.ts` re-exporters. Every consumer imports directly from the source file that defines the symbol.
- **`.ts` extensions on relative imports** — all internal imports use `.ts` (e.g., `'./foo.ts'`). Package imports keep their original extension (e.g., `'@modelcontextprotocol/sdk/server/mcp.js'`).

## Naming Conventions

- **Files** — `kebab-case.ts`. Suffix encodes role: `.const.ts` (constants), `.type.ts` (type-only files), `.schema.ts` (Zod schemas), `.handler.ts` (MCP tool handlers), `.builder.ts` (tool/arg builders), `.util.ts` (utility helpers).
- **Module-level constants** — `SCREAMING_SNAKE_CASE` (`MAX_PROMPT_BYTES`, `SAFE_ENV_KEYS`, `FLAG_MODEL`).
- **Functions** — `camelCase`. Naming reflects role: `handleX` (MCP handlers), `buildX` (factories/constructors), `validateX` (validation), `resolveX` (resolution/lookup), `createX` (factories).
- **Types** — `PascalCase` (`ResolvedProviderEntry`, `ExecuteCommandOptions`). No `I` prefix on interfaces, no `T` prefix on type parameters (except in test utility generic types).
- **`as const` arrays** — fixed value sets use `const ARRAY = [...] as const` with a derived type `type X = (typeof ARRAY)[number]` when needed. `as const` is not used on object literals.

## Module Internal Structure

Every file follows this top-to-bottom order:

1. Imports (stdlib → external → internal, blank lines between groups)
2. Module-private constants (`const SCREAMING = ...`)
3. Module-private type aliases (`type Foo = ...`)
4. Module-private helper functions (unexported)
5. Exported functions/types/constants (always last in the file)

The primary export is always the last declaration. In files with one public export, all private helpers build up to it.

## Error Handling

- **`unknown` for caught errors** — always `catch (error: unknown)`, never `any` or bare `Error`.
- **`main()` pattern for scripts** — entry-point scripts define `const main = async (): Promise<void>` and call it with `.catch((error: unknown) => { ... process.exit(1) })`.
- **Single top-level `try/catch` in handlers** — handlers wrap their entire body in one `try/catch`, delegating to `toMcpError(error)` for conversion.
- **`{ cause: error }` for error chaining** — pass the original error as `cause` when wrapping in a new error.

## Comments

- **Minimal comments** — explain _why_, not _what_. No JSDoc except for non-obvious dispatch logic (e.g., documenting a multi-branch flag resolution function).
- **No block comments** (`/* */`) in production code — use `//` with a space and sentence-case text.
- **No commented-out code** — delete dead code rather than commenting it out.

## Testing Style

- **Unit test extension**: use `.spec.ts` (not `.test.ts`). Place test files co-located next to the module they test (e.g. `foo.ts` → `foo.spec.ts`).
- **Integration test extension**: use `.test.ts`. These run under a separate vitest config (`vitest.config.integration.ts`).

Use GIVEN/WHEN/THEN phrasing for test cases to make intent explicit. All three keywords are **UPPERCASE** — no variations.

- **GIVEN** the initial context/setup
- **WHEN** the behaviour under test is executed
- **THEN** the expected outcome is asserted

Example naming pattern: `GIVEN X WHEN Y THEN Z`.

- **No section separator comments** in test files — no `// -----------` banners between `describe` blocks. The `describe` blocks provide sufficient structure on their own.
- **`toStrictEqual` over `toEqual`** — always prefer `toStrictEqual` for structural object/array comparisons. It catches `undefined` properties and prototype differences that `toEqual` misses. Use `toBe` for primitives and booleans.
- **Factory functions for test data** — name them `create*`, `build*`, or `make*` with an `overrides: Partial<T> = {}` parameter that spreads over defaults. Test data is always local to the spec file — no shared fixture directories.
- **`vi.hoisted()` for cross-module mock dependencies** — when multiple `vi.mock()` calls share mock references, collect them in a single `const mocks = vi.hoisted(() => ({ ... }))` object at file top.
- **`vi.mock()` always with factory function** — use `vi.mock(path, () => ({ ... }))`, never bare `vi.mock(path)`. Paths use `.ts` extensions.
- **`vi.mocked()` for typed mock access** — access mock instances through `vi.mocked(fn)`, never via direct cast.
- **Mock reset strategy** — `vi.clearAllMocks()` in `beforeEach` for inline mocks; `.mockReset()` per mock for hoisted mocks. `vi.restoreAllMocks()` in `afterEach` whenever `vi.spyOn()` is used.
- **No `it.each` / `describe.each`** — write explicit individual `it()` calls instead of parameterized tests.
- **Two-level `describe` nesting** — one top-level `describe` per export, inner `describe` blocks grouping by scenario category (noun phrases like `'successful execution'`, `'validation errors'`).

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
- **Never add `eslint-disable` comments** — fix the underlying code instead. Use bracket notation for problematic property names (`['_meta']` instead of `_meta`), restructure assertions to avoid `any`-typed matchers in object literals, and reduce cyclomatic complexity by extracting helpers or using `.map()`. If a lint rule cannot be satisfied without a disable comment, raise it for discussion rather than suppressing.
