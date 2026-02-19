# Contributing to agentic-mcp

Thanks for your interest in contributing! This project is in early development.

## Getting Started

1. Fork and clone the repo
2. Install dependencies: `pnpm install`
3. Build: `pnpm build`
4. Run tests: `pnpm test`

## Ways to Contribute

### Add a New CLI Provider

Adding a CLI requires zero code changes — just a JSON config entry in `providers.json`:

1. Add an entry following the existing provider configs
2. Test with `ping_{provider}` and `ask_{provider}`
3. Submit a PR

### Report a Bug

Open an issue with:

- What you expected vs what happened
- Steps to reproduce
- Environment (OS, Node.js version, CLI provider)

### Fix a Bug or Add a Feature

1. Check existing issues first
2. Create a branch from `master`
3. Make your changes with tests
4. Submit a PR

## Code Guidelines

- TypeScript strict mode
- Validate inputs with Zod
- Use `spawn()` with array args — never pass user input through a shell
- Keep provider logic in config, not in code

## Pull Requests

- One feature or fix per PR
- Clear description of what and why
- CI must pass (lint + typecheck + tests)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
