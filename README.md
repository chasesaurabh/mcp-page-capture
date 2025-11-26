# mcp-page-capture

[![npm version](https://img.shields.io/npm/v/mcp-page-capture?color=blue&label=npm)](https://www.npmjs.com/package/mcp-page-capture)
[![GitHub stars](https://img.shields.io/github/stars/chasesaurabh/mcp-page-capture?style=social)](https://github.com/chasesaurabh/mcp-page-capture)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)
![MCP Server](https://img.shields.io/badge/MCP%20Server-Ready-6f42c1)

![mcp-page-capture logo placeholder](docs/assets/mcp-page-capture-logo-placeholder.png)

mcp-page-capture is a Model Context Protocol (MCP) server that orchestrates headless Chromium via Puppeteer to capture pixel-perfect screenshots of arbitrary URLs. It is optimized for Copilot/MCP-enabled environments and can be embedded into automated workflows or run as a standalone developer tool.

## Features
- 📸 High-fidelity screenshots powered by Puppeteer and headless Chromium.
- ⚙️ Declarative MCP tool schema for predictable integrations and strong validation.
- 🛡️ Structured logging plus defensive error handling for operational visibility.
- 🔌 Launch via `npm start`, `npm run dev`, or as a long-lived MCP sidecar.
- 🧩 Configurable options for target URL selection and full-page captures.

## How It Works
1. The MCP transport boots a Node.js server and registers the `captureScreenshot` tool.
2. Incoming tool invocations are validated against the `screenshot` type definitions.
3. Puppeteer starts (or reuses) a Chromium instance, navigates to the requested URL, and applies viewport/full-page instructions.
4. The rendered screenshot is persisted locally (or to another destination in future releases) and metadata is returned to the caller.

## Requirements
- Node.js ≥ 18.x
- npm ≥ 9.x
- Chromium package download permissions (first run)
- Network access to the target URLs

## Installation

### From source (recommended during development)
```powershell
git clone https://github.com/chasesaurabh/mcp-page-capture.git
npm install
```

### From npm
```powershell
# Run without installing globally
npx mcp-page-capture

# Or add it to your toolchain
npm install -g mcp-page-capture
mcp-page-capture
```

## Running the server
```
npm install
npm run build
npm start
```

For hot reload while iterating locally, run `npm run dev`.

## Why Docker?
- Guarantees a consistent Puppeteer + Chromium environment with all system libraries when teammates or CI run the server. No more "it works on my machine" mismatches.
- Provides a ready-to-deploy container image for hosting mcp-page-capture as a sidecar/service on Kubernetes, ECS, Fly.io, etc.

If you need those guarantees, build and run via:
```powershell
docker build -t mcp-page-capture .
docker run --rm -it mcp-page-capture
```
Otherwise you can keep using the standard npm scripts locally.

## Copilot MCP configuration
```json
{
  "mcpServers": {
    "page-capture": {
      "command": "node",
      "args": ["dist/cli.js"]
    }
  }
}
```

## Programmatic usage

If you want to embed the server inside another Node.js process, import the helpers exposed by the package:

```ts
import { startMcpPageCaptureServer } from "mcp-page-capture";

await startMcpPageCaptureServer();
// Optionally pass a custom Transport implementation if you don't want stdio.
```

## Usage

### Tool invocation examples
```json
{
  "server": "page-capture",
  "tool": "captureScreenshot",
  "params": {
    "url": "https://example.com",
    "fullPage": false
  }
}
```

```json
{
  "server": "page-capture",
  "tool": "captureScreenshot",
  "params": {
    "url": "https://docs.modelcontextprotocol.io",
    "fullPage": true
  },
  "metadata": {
    "requestId": "docs-home"
  }
}
```

```json
{
  "server": "page-capture",
  "tool": "captureScreenshot",
  "params": {
    "url": "https://example.com/dashboard",
    "headers": {
      "authorization": "Bearer dev-token"
    },
    "cookies": [
      {
        "name": "session",
        "value": "abc123",
        "path": "/secure"
      }
    ]
  }
}
```

### Example response
```json
{
  "status": "Screenshot captured successfully",
  "path": "captures/example-com-2025-11-23T08-30-12.png",
  "width": 1280,
  "height": 720,
  "fullPage": false,
  "timestamp": "2025-11-23T08:30:12.713Z"
}
```

## Supported options
- `url` (string, required): Fully-qualified URL to capture.
- `fullPage` (boolean, optional, default `false`): Capture the entire scrollable page instead of the current viewport.
- `headers` (object, optional): Key/value map of HTTP headers to send with the initial page navigation.
- `cookies` (array, optional): List of cookies to set before navigation. Each cookie supports `name`, `value`, and optional `url`, `domain`, `path`, `secure`, `httpOnly`, `sameSite`, and `expires` (Unix timestamp, seconds).

## Known limitations
- Dynamic pages requiring authentication or user gestures are not yet automated.
- Extremely long or infinite-scroll pages may exceed default Chromium memory limits.
- Output destinations are local-only; remote storage adapters are tracked on the roadmap.

## Roadmap
- Configurable output targets (S3, Azure Blob, GCS).
- Advanced viewport presets and mobile emulation profiles.
- Automatic retries/backoff for transient navigation failures.
- Telemetry hooks for centralized observability.
- Docker image publishing and npm package distribution.

## How to contribute
Read `CONTRIBUTING.md`, open an issue describing the change, and submit a PR that includes `npm run build` output plus updated docs/tests.

## Author / Maintainer
Maintained by **Saurabh Chase (@chasesaurabh)**. Reach out via issues or discussions for roadmap coordination.

## License
Released under the [MIT License](LICENSE).
