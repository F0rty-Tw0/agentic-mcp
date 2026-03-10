# AGENTS.md — Coding Conventions

## Things You Will Get Wrong

- **No enums, no namespaces** — `erasableSyntaxOnly` is on. You will try to write enums. Don't.
- **No classes** — use functions and plain objects. The only exception is `Error` subclasses (they need `instanceof` and stack traces).
- **No default exports** — all exports are named, inline on the declaration.
- **No extensions on relative imports** — use `'./foo'`, never `'./foo.ts'` or `'./foo.js'`. Package imports keep their original extension.
- **`node:` prefix mandatory** — always `import from 'node:fs/promises'`, never bare `'fs/promises'`.
- **`import type` for type-only imports** — enforced by `verbatimModuleSyntax`. You will forget this.
- **No `import type * as` namespace imports** — import the specific types directly. If a type is reused across files in one top-level module, move it into that module's `common/` folder and import it from there. Do not reach for `typeof import('./foo')` or module-wide type namespaces when a direct type import would tell the truth.
- **`catch (error: unknown)`** — never `any`, never bare `Error`.
- **`toStrictEqual` over `toEqual`** — always. Use `toBe` for primitives.
- **No `eslint-disable` comments** — fix the code instead. Refactor to reduce complexity, extract helpers, restructure loops.
- **No JSDoc, no block comments (`/* */`), no commented-out code.**
- **camelCase for local variables** — never `snake_case`. Map to snake_case keys only at the object-literal boundary: `{ working_directory: workingDirectory }`.

## File & Naming

- Files: `kebab-case.ts` with role suffix: `.const.ts`, `.type.ts`, `.schema.ts`, `.handler.ts`, `.builder.ts`, `.util.ts`.
- Constants: `SCREAMING_SNAKE_CASE`. Types: `PascalCase`. Functions: `camelCase`.
- Barrel `index.ts` at four levels:
  - **Module root** (`ask/index.ts`): wildcard re-exports from subdirs (`export * from './common'`).
  - **`domain-logic/`**: named re-exports only — this is the module's public API surface.
  - **`common/`**, **`utils/`**, **`stubs/`**: named re-exports, no wildcards.

## Module Structure

- Each feature lives in its own top-level `src/` directory (e.g., `ask/`, `streaming/`, `session/`).
- Standard subdirectories: `domain-logic/` (business logic, handlers), `common/` (types, constants, stubs), `utils/` (pure helper functions).
- Not every module needs all three — only create subdirs that have content.
- **Shared module types live in `common/`** — if a type is used from multiple files in the same module, move it to `common/` and import it from that module's `common` barrel. Prefer direct named imports over local module-type wrappers.
- **Cross-module shared types live in `src/shared/common/`** — only move a type there when multiple top-level modules truly depend on it.
- **No type forwarding through `domain-logic/` or `utils/`** — do not re-export types from those layers just to make them reachable elsewhere. Move the type to `common/` instead.
- Test stubs live in `common/stubs/` with their own barrel `index.ts`.

## Testing

- Unit tests: `.spec.ts` (not `.test.ts`), co-located next to the module.
- Integration tests: `.test.ts`, separate vitest config.
- Test naming: `GIVEN X WHEN Y THEN Z` (all three keywords uppercase).
- `vi.mock()` always with factory function. `vi.mocked()` for typed access. `vi.hoisted()` for shared mock refs.
- **No dynamic `import()` of local modules in tests** — prefer static imports. Never write `const module = await import('./foo')`, whether it sits at top level, inside `beforeAll`, or inside a helper after `vi.resetModules()`. Use `vi.hoisted()`, `vi.mock()`, and `vi.spyOn()` to control collaborators. If you need to prove persisted or cross-invocation behavior, verify files on disk or spawn a child process.
- **No top-level `await import()` in tests** — keep imports static. A helper that wraps `await import('./foo')` is still the same anti-pattern; fix the test shape instead of hiding the import behind indirection.
- No `it.each` / `describe.each` — write explicit individual `it()` calls.
- Factory functions for test data: `create*`/`build*`/`make*` with `overrides: Partial<T> = {}`.
- **Complete stubs** — test stubs must include ALL required properties of the type they represent. Never pass partial objects where full types are expected; use factory functions with defaults for every field.
- **No `expect` inside conditionals** — never put `expect()` inside `if`, `try/catch`, or ternary. Use `.catch()` chains or restructure assertions to be unconditional.
- **Use `vi.restoreAllMocks()`** — in `afterEach`, prefer `vi.restoreAllMocks()` over calling `.mockRestore()` on individual spies (avoids unsafe `any` access).
- **Complexity max 3 in tests** — the linter enforces a lower complexity threshold in test files. Extract helper functions (`pollOnce`, `isAvailable`, etc.) to keep each test callback under the limit.

## TDD (Mandatory)

No production code before a failing test. Red -> Green -> Refactor. If you wrote implementation first, delete it and start from a failing test.

## Size & Complexity Limits

- **Max 50 lines per function** — extract helpers when approaching the limit. Applies to source and test helpers alike.
- **Max complexity 10 (source), 3 (tests)** — the linter counts `if`, `for`, `while`, `catch`, `||`, `&&`, `??`, `?.` as branches. Use data-driven maps, helper functions, and early returns to stay within limits.
- **Spread conditionals count as branches** — `...(x && { key: x })` repeated N times = N branches. Use a loop over a field map or build an intermediate object and filter instead.
- **Padding lines between statement groups** — the `@stylistic/padding-line-between-statements` rule requires blank lines after `const`/`let` before expression statements.
- **Dot notation over bracket notation** — use `obj.key` not `obj['key']` when the key is a static string literal.
- **`promise-function-async` + `require-await`** — if a function returns a `Promise`, it must be `async`. If it's `async`, it must contain `await`. Satisfy both: `async () => { const result = await Promise.resolve(value); return result; }`.

## Patterns You Must Follow

- **Guard-first** — early returns over nested blocks.
- **`Readonly<>`** — wrap type aliases by default. Also wrap nested `Record<>` fields.
- **Named variables before use** — `const result: Type = { ... }; return result;` instead of returning literals directly. Same for push: `const item: Type = { ... }; list.push(item);` — never inline objects into `push()`, `return`, or function arguments.
- **Name stable contracts explicitly** — do not use `ReturnType<typeof someFunction>` for reusable domain, transport, or test-contract types. Export a named type from the owning `common/` module and import it directly.
- **Prefer real library/domain types over derived function types** — use `CallToolResult`, `ExecutionResult`, `ChildProcess`, `MockInstance`, etc. instead of reverse-engineering them with `ReturnType`.
- **Null checks for config values** — use `value == null`, not `!value` (preserves falsy-but-valid values like `""` or `0`).
- **Custom error classes** — throw `ValidationError` or `CommandExecutionError`, never bare `Error`.
- **No magic numbers** — extract to constants in `src/shared/`.
- **Single input object** — functions with 3+ parameters take one `Readonly<{...}>` typed object, not positional args. Name the type `*Input`, `*Context`, or `*Options`.
- **Destructure at use-site** — destructure input objects inside the function body, not in the parameter list: `const { a, b } = input;`.
- **Variable name mirrors type** — `buildAttributionInput: BuildAttributionInput`, `modelHintContext: ModelHintContext`.
- **`Pick<>` for narrow dependencies** — when a function only needs a few fields from a large type, use `Pick<ExecutionResult, 'executionTimeMs' | 'truncated'>`.
- **Private helpers as module-level `const`** — extract non-exported helper functions at module scope, not inline or nested.
