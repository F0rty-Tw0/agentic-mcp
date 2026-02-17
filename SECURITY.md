# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. Email **security@f0rty-tw0.dev** with details
3. Include steps to reproduce if possible

You should receive a response within 48 hours.

## Security Considerations

agentic-mcp spawns child processes to invoke CLI tools. The following safeguards are in place:

- All inputs are validated with Zod schemas
- Child processes use `spawn()` with array args (no shell interpolation)
- Child environments are isolated (minimal base, not full `process.env`)
- CLI binary paths are resolved and pinned at startup
- Output is size-limited to prevent memory exhaustion
