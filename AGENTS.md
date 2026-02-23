# AGENTS.md — Coding Conventions

## Things You Will Get Wrong

- **No enums, no namespaces** — `erasableSyntaxOnly` is on. You will try to write enums. Don't.
- **No classes** — use functions and plain objects. The only exception is `Error` subclasses (they need `instanceof` and stack traces).
- **No default exports** — all exports are named, inline on the declaration.
- **`node:` prefix mandatory** — always `import from 'node:fs/promises'`, never bare `'fs/promises'`.
- **`import type` for type-only imports** — enforced by `verbatimModuleSyntax`. You will forget this.
- **`catch (error: unknown)`** — never `any`, never bare `Error`.
- **`toStrictEqual` over `toEqual`** — always. Use `toBe` for primitives.
- **No `eslint-disable` comments** — fix the code instead.
- **No JSDoc, no block comments (`/* */`), no commented-out code.**

## File & Naming

- Files: `kebab-case.ts` with role suffix: `.const.ts`, `.type.ts`, `.schema.ts`, `.handler.ts`, `.builder.ts`, `.util.ts`.
- Constants: `SCREAMING_SNAKE_CASE`. Types: `PascalCase`. Functions: `camelCase`.
- Barrel `index.ts` only inside `common/`, `stubs/`, `utils/` — named re-exports, no wildcards.

## Testing

- Unit tests: `.spec.ts` (not `.test.ts`), co-located next to the module.
- Integration tests: `.test.ts`, separate vitest config.
- Test naming: `GIVEN X WHEN Y THEN Z` (all three keywords uppercase).
- `vi.mock()` always with factory function. `vi.mocked()` for typed access. `vi.hoisted()` for shared mock refs.
- No `it.each` / `describe.each` — write explicit individual `it()` calls.
- Factory functions for test data: `create*`/`build*`/`make*` with `overrides: Partial<T> = {}`.

## TDD (Mandatory)

No production code before a failing test. Red -> Green -> Refactor. If you wrote implementation first, delete it and start from a failing test.

## Patterns You Must Follow

- **Guard-first** — early returns over nested blocks.
- **`Readonly<>`** — wrap type aliases by default. Also wrap nested `Record<>` fields.
- **Named return variables** — `const result: Type = { ... }; return result;` instead of returning literals directly.
- **Null checks for config values** — use `value == null`, not `!value` (preserves falsy-but-valid values like `""` or `0`).
- **Custom error classes** — throw `ValidationError` or `CommandExecutionError`, never bare `Error`.
- **No magic numbers** — extract to constants in `src/shared/`.
