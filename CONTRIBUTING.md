# Contributing to mcp-page-capture

Thank you for your interest in improving mcp-page-capture! This guide explains how to propose changes, report issues, and keep the release process smooth.

## Code of Conduct
Participation requires adherence to the [Code of Conduct](CODE_OF_CONDUCT.md). Please review it before engaging with the community.

## Development environment
1. Install Node.js ≥ 18 and npm ≥ 9.
2. Clone the repository and install dependencies:
   ```powershell
   npm install
   ```
3. Build or run in watch mode as needed:
   ```powershell
   npm run build
   npm run dev
   ```

## Workflow
- Create a feature branch (`feature/<topic>` or `fix/<issue-number>`).
- Keep changes focused and incremental; prefer multiple small PRs to a very large one.
- Write descriptive commit messages (e.g., `<area>: <change>`).

## Testing & quality gates
- Run `npm run build` before pushing.
- Execute any configured lint/test scripts (for example `npm run lint` or `npm test`) if they exist in `package.json`.
- Update documentation, examples, and `CHANGELOG.md` when behavior changes.

## Pull request checklist
- Reference the related issue or create one if it does not exist.
- Describe the change, rationale, and validation steps in the PR template.
- Attach screenshots/log snippets for UI or runtime changes when relevant.
- Confirm `npm run build` succeeds in CI and locally.

## Reporting issues
When opening an issue, include:
- Expected vs. actual behavior.
- Steps to reproduce (commands, inputs, URLs).
- Environment details (OS, Node.js version, Puppeteer/Chrome versions).

Security-sensitive findings should follow the [security policy](SECURITY.md).

## Release process overview
1. Update `CHANGELOG.md` with a new entry.
2. Bump the version in `package.json`.
3. Tag the release and publish artifacts (npm package, Docker image).
4. Announce changes in the README or project discussions.

Your contributions make MCP tooling better—thank you!
