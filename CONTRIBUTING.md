# Contributing Guide

Thanks for considering contributing to cursor-db-mcp!

## Development Setup
- Node.js 18+ (or latest LTS)
- npm
- macOS/Linux/Windows supported

```bash
npm install
npm run build
npm run inspector
```

## Branch & Commit
- Use feature branches: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`
- Conventional commits encouraged (e.g., `feat: add diagnose_storage tool`)

## Pull Requests
- Describe the problem and solution clearly
- Include tests or manual steps to verify
- Keep diffs focused and small where possible

## Coding Standards
- TypeScript strict mode is enabled
- Follow existing code style (readability, early returns, no deep nesting)
- Avoid broad refactors unrelated to the change

## Testing
- Ensure `npm run build` succeeds
- Use MCP Inspector (`npm run inspector`) to validate tool calls

## Reporting Issues
- Provide environment (OS, Node, Cursor version)
- Steps to reproduce
- Expected vs actual behavior
- Logs or minimal repro data if possible

## Security
See SECURITY.md for security policies and how to report vulnerabilities.
