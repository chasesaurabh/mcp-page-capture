## 1.2.0 (2025-11-29)

* chore(release): 1.0.0 ([8f541d5](https://github.com/chasesaurabh/mcp-page-capture/commit/8f541d5))
* feat: document release triggers ([cf3eeca](https://github.com/chasesaurabh/mcp-page-capture/commit/cf3eeca))
* Add release automation with semantic-release and GitHub Actions ([c528732](https://github.com/chasesaurabh/mcp-page-capture/commit/c528732))

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

### Added
- **Advanced Viewport Presets**: Added comprehensive viewport presets for desktop (FHD, HD, 4K, MacBook Pro), tablets (iPad Pro, iPad, Surface Pro), and mobile devices (iPhone 14 Pro Max/Pro, iPhone SE, Pixel 7 Pro, Galaxy S23 Ultra) with proper user agents and device emulation
- **Automatic Retry Logic**: Implemented automatic retry with exponential backoff for transient failures (HTTP 5xx, timeouts, DNS errors) with configurable retry policies
- **Telemetry System**: Added comprehensive telemetry hooks with event emitter for monitoring tool invocations, navigation events, retries, and browser lifecycle with support for HTTP sink and custom handlers
- **Pluggable Storage Backends**: Introduced abstraction for storage targets with implementations for local filesystem, S3-compatible storage (placeholder), and in-memory storage
- **Docker Multi-Platform Support**: Updated Docker build to support multi-platform images (linux/amd64, linux/arm64) with automated publishing to Docker Hub and GitHub Container Registry
- **Enhanced Tool Options**: Extended `captureScreenshot` and `extractDom` tools with viewport configuration, retry policies, and storage target selection
- **Non-root Docker User**: Improved security by running container as non-root user with proper volume mounts
- **Health Checks**: Added Docker health check for container monitoring
- **GitHub Actions Enhancements**: Extended CI/CD pipeline to automatically build and publish Docker images on releases

### Changed
- Refactored Puppeteer launch logic to be DRY and support viewport emulation
- Updated tool schemas with Zod validation for new configuration options
- Enhanced error handling with retry context and telemetry integration
- Improved Dockerfile with multi-stage build optimizations and security best practices

### Fixed
- Added proper viewport and user agent handling for mobile device emulation
- Improved error messages to include retry attempt information
- Fixed TypeScript compilation issues with proper type exports

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
