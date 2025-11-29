## 1.0.0 (2025-11-29)

* feat: document release triggers ([cf3eeca](https://github.com/chasesaurabh/mcp-page-capture/commit/cf3eeca))
* Add DOM extraction functionality with support for optional CSS selectors and HTTP headers ([4480ce8](https://github.com/chasesaurabh/mcp-page-capture/commit/4480ce8))
* Add release automation with semantic-release and GitHub Actions ([c528732](https://github.com/chasesaurabh/mcp-page-capture/commit/c528732))
* Add support for headers and cookies in screenshot capture functionality ([8fc52c4](https://github.com/chasesaurabh/mcp-page-capture/commit/8fc52c4))
* Add Vitest for testing framework and implement integration tests for tools ([99b5aea](https://github.com/chasesaurabh/mcp-page-capture/commit/99b5aea))
* Fix server name in createPageCaptureServer function to match repository name ([b821de6](https://github.com/chasesaurabh/mcp-page-capture/commit/b821de6))
* Initialized mcp-page-capture project with screenshot capture functionality ([6a28e03](https://github.com/chasesaurabh/mcp-page-capture/commit/6a28e03))
* Prepare npm package for release ([d9ba55f](https://github.com/chasesaurabh/mcp-page-capture/commit/d9ba55f))
* Update version to 1.1.0 and add changelog entries for new features ([11065ea](https://github.com/chasesaurabh/mcp-page-capture/commit/11065ea))

# Changelog

All notable changes to this project will be documented in this file following [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.1.0] - 2025-11-26
### Added
- Added a distributable CLI (`mcp-page-capture`) plus programmatic helpers for custom transports.
- Generated type declarations and conditional exports for consumers importing the server.
- Added publish-time build automation and documentation for the npm package.

## [1.0.0] - 2025-11-24
### Added
- Initial MCP server implementation powered by Puppeteer.
- `captureScreenshot` tool with `url` and `fullPage` options.
- Logging utilities, type definitions, and development scripts.
- Documentation set: README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, LICENSE.
- Repository metadata for npm publishing.
- Docker support for consistent deployment.
