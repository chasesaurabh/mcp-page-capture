# mcp-page-capture

[![npm version](https://img.shields.io/npm/v/mcp-page-capture?color=blue&label=npm)](https://www.npmjs.com/package/mcp-page-capture)
[![GitHub stars](https://img.shields.io/github/stars/chasesaurabh/mcp-page-capture?style=social)](https://github.com/chasesaurabh/mcp-page-capture)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)
![MCP Server](https://img.shields.io/badge/MCP%20Server-Ready-6f42c1)

![mcp-page-capture logo placeholder](docs/assets/mcp-page-capture-logo-placeholder.png)

mcp-page-capture is a Model Context Protocol (MCP) server that orchestrates headless Chromium via Puppeteer to capture pixel-perfect screenshots of arbitrary URLs. It is optimized for Copilot/MCP-enabled environments and can be embedded into automated workflows or run as a standalone developer tool.

## Features
- 📸 High-fidelity screenshots powered by Puppeteer and headless Chromium
- ⚙️ Declarative MCP tool schema for predictable integrations and strong validation
- 🔍 Structured DOM extraction with optional CSS selectors for AI-friendly consumption
- 📱 Advanced viewport presets and mobile emulation profiles (iPhone, iPad, Android, desktop)
- 🔄 Automatic retry with exponential backoff for transient failures
- 📊 Telemetry hooks for centralized observability and monitoring
- 💾 Pluggable storage backends (local filesystem, S3, memory)
- 🛡️ Structured logging plus defensive error handling for operational visibility
- 🔌 Launch via `npm start`, `npm run dev`, or as a long-lived MCP sidecar
- 🧩 Configurable options for target URL selection and full-page captures
- 🐳 Docker image with multi-platform support (amd64, arm64)

## How It Works
1. The MCP transport boots a Node.js server and registers the `captureScreenshot` and `extractDom` tools.
2. Incoming tool invocations are validated against the relevant type definitions.
3. Puppeteer starts (or reuses) a Chromium instance, navigates to the requested URL, and either captures a screenshot or serializes the DOM according to the tool parameters.
4. The server returns structured content (images, text, DOM trees, metadata) to the caller or downstream workflow.

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

```json
{
  "server": "page-capture",
  "tool": "extractDom",
  "params": {
    "url": "https://docs.modelcontextprotocol.io",
    "selector": "main article"
  }
}
```

```json
{
  "server": "page-capture",
  "tool": "captureScreenshot",
  "params": {
    "url": "https://example.com/form",
    "steps": [
      {
        "type": "text",
        "selector": "#username",
        "value": "john.doe@example.com"
      },
      {
        "type": "text",
        "selector": "#password",
        "value": "secure123"
      },
      {
        "type": "click",
        "selector": "button[type='submit']",
        "waitForNavigation": true
      },
      {
        "type": "screenshot",
        "fullPage": true
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

### `captureScreenshot`
- `url` (string, required): Fully-qualified URL to capture
- `fullPage` (boolean, optional, default `false`): Capture the entire scrollable page instead of the current viewport
- `headers` (object, optional): Key/value map of HTTP headers to send with the initial page navigation
- `cookies` (array, optional): List of cookies to set before navigation. Each cookie supports `name`, `value`, and optional `url`, `domain`, `path`, `secure`, `httpOnly`, `sameSite`, and `expires` (Unix timestamp, seconds)
- `viewport` (object, optional): Viewport configuration
  - `preset` (string, optional): Use a predefined viewport preset (see Viewport Presets section)
  - `width` (number, optional): Custom viewport width
  - `height` (number, optional): Custom viewport height
  - `deviceScaleFactor` (number, optional): Device scale factor (e.g., 2 for Retina)
  - `isMobile` (boolean, optional): Whether to emulate mobile device
  - `hasTouch` (boolean, optional): Whether to enable touch events
  - `userAgent` (string, optional): Custom user agent string
- `retryPolicy` (object, optional): Retry configuration for transient failures
  - `maxRetries` (number, optional, default 3): Maximum number of retry attempts
  - `initialDelayMs` (number, optional, default 1000): Initial delay between retries
  - `maxDelayMs` (number, optional, default 10000): Maximum delay between retries
  - `backoffMultiplier` (number, optional, default 2): Exponential backoff multiplier
- `storageTarget` (string, optional): Storage backend name for saving captures

### `extractDom`
- `url` (string, required): Fully-qualified URL to inspect
- `selector` (string, optional): CSS selector to scope extraction to a specific element. Defaults to the entire document
- `headers` (object, optional): Key/value map of HTTP headers sent before navigation
- `cookies` (array, optional): Same cookie structure as `captureScreenshot`, applied before navigation
- `viewport` (object, optional): Same viewport configuration as `captureScreenshot`
- `retryPolicy` (object, optional): Same retry configuration as `captureScreenshot`
- `storageTarget` (string, optional): Storage backend name for saving DOM data

## Action Steps for captureScreenshot

The `captureScreenshot` tool supports a comprehensive `steps` array that allows you to perform various web interactions before capturing the screenshot. Each step is executed in sequence, allowing for complex automation scenarios.

### Text Input (`text`)
Type text into input fields:
```json
{
  "type": "text",
  "selector": "#username",
  "value": "john.doe@example.com",
  "clearFirst": true,  // Clear existing text first (default: true)
  "delay": 100,  // Delay between keystrokes in ms (0-1000)
  "pressEnter": false  // Press Enter after typing (default: false)
}
```

### Select Dropdown (`select`)
Select an option from a dropdown:
```json
{
  "type": "select",
  "selector": "#country",
  "value": "us"  // OR "text": "United States" OR "index": 0
}
```

### Radio Button (`radio`)
Select a radio button:
```json
{
  "type": "radio",
  "selector": "input[type='radio']",
  "value": "option1",  // Value attribute of the radio button
  "name": "preference"  // Name attribute to identify the radio group
}
```

### Checkbox (`checkbox`)
Check or uncheck a checkbox:
```json
{
  "type": "checkbox",
  "selector": "#agree-terms",
  "checked": true  // true to check, false to uncheck
}
```

### Click (`click`)
Click on elements:
```json
{
  "type": "click",
  "selector": "button.submit",
  "button": "left",  // "left", "right", or "middle" (default: left)
  "clickCount": 1,  // 1=single, 2=double, 3=triple (default: 1)
  "waitForNavigation": false,  // Wait for page navigation (default: false)
  "waitForSelector": ".modal-content"  // Wait for element to appear after click
}
```

### Hover (`hover`)
Hover over elements:
```json
{
  "type": "hover",
  "selector": ".dropdown-trigger",
  "duration": 1000  // How long to maintain hover in ms (0-10000)
}
```

### File Upload (`upload`)
Upload files:
```json
{
  "type": "upload",
  "selector": "input[type='file']",
  "filePaths": ["/path/to/file1.pdf", "/path/to/file2.jpg"]
}
```

### Form Submit (`submit`)
Submit forms:
```json
{
  "type": "submit",
  "selector": "#contact-form",  // Form element or submit button
  "waitForNavigation": true  // Wait for page navigation (default: true)
}
```

### Scroll (`scroll`)
Scroll the page:
```json
{
  "type": "scroll",
  "selector": "#section-2",  // Scroll to element (takes precedence)
  "x": 0,  // OR horizontal scroll position in pixels
  "y": 500,  // OR vertical scroll position in pixels
  "behavior": "smooth"  // "auto" or "smooth" (default: auto)
}
```

### Key Press (`keypress`)
Press keyboard keys:
```json
{
  "type": "keypress",
  "key": "Enter",  // Key to press (e.g., "Enter", "Tab", "Escape", "ArrowDown")
  "modifiers": ["Control", "Shift"],  // Optional modifiers
  "selector": "#search-box"  // Optional element to focus first
}
```

### Wait for Selector (`waitForSelector`)
Wait for element to appear:
```json
{
  "type": "waitForSelector",
  "selector": ".loading-complete",
  "timeout": 10000  // Timeout in ms (default: 10000)
}
```

### Delay (`delay`)
Wait for specified duration:
```json
{
  "type": "delay",
  "duration": 2000  // Wait duration in ms
}
```

### Focus (`focus`)
Focus an element:
```json
{
  "type": "focus",
  "selector": "#search-input"
}
```

### Blur (`blur`)
Blur (unfocus) an element:
```json
{
  "type": "blur",
  "selector": "#search-input"
}
```

### Clear (`clear`)
Clear input field contents:
```json
{
  "type": "clear",
  "selector": "#search-input"
}
```

### Evaluate (`evaluate`)
Execute custom JavaScript:
```json
{
  "type": "evaluate",
  "script": "document.title = 'New Title'; return document.title;",
  "selector": "#element"  // Optional element to pass to the script
}
```

### Screenshot (`screenshot`)
Capture screenshot at any point:
```json
{
  "type": "screenshot",
  "fullPage": true,  // Capture entire page (optional)
  "selector": ".specific-element"  // Capture specific element (optional)
}
```

### Cookie Management (`cookie`)
Manage browser cookies:
```json
{
  "type": "cookie",
  "action": "set",  // "set", "delete", "get", or "list"
  "name": "session_id",
  "value": "abc123",
  "domain": ".example.com",
  "path": "/",
  "secure": true
}
```

### Storage Management (`storage`)
Manage localStorage/sessionStorage:
```json
{
  "type": "storage",
  "storageType": "localStorage",  // or "sessionStorage"
  "action": "set",  // "set", "delete", "clear", "get", or "list"
  "key": "user_preferences",
  "value": "{\"theme\":\"dark\"}"
}
```

### Example: Complex Form Interaction with Screenshot
```json
{
  "tool": "captureScreenshot",
  "params": {
    "url": "https://example.com/signup",
    "steps": [
      { "type": "waitForSelector", "selector": "#signup-form" },
      { "type": "text", "selector": "#email", "value": "user@example.com" },
      { "type": "text", "selector": "#password", "value": "SecurePass123!" },
      { "type": "select", "selector": "#country", "text": "United States" },
      { "type": "radio", "selector": "input[name='plan']", "value": "premium" },
      { "type": "checkbox", "selector": "#newsletter", "checked": true },
      { "type": "checkbox", "selector": "#terms", "checked": true },
      { "type": "hover", "selector": ".tooltip-trigger", "duration": 500 },
      { "type": "scroll", "y": 200 },
      { "type": "click", "selector": "button[type='submit']", "waitForNavigation": true },
      { "type": "delay", "duration": 2000 },
      { "type": "screenshot", "fullPage": true }
    ]
  }
}
```

## Viewport Presets

The following viewport presets are available:

### Desktop
- `desktop-fhd`: 1920x1080 Full HD
- `desktop-hd`: 1280x720 HD
- `desktop-4k`: 3840x2160 4K
- `macbook-pro-16`: MacBook Pro 16-inch Retina

### Tablets
- `ipad-pro`: iPad Pro 12.9-inch
- `ipad-pro-landscape`: iPad Pro 12.9-inch (landscape)
- `ipad`: iPad 10.2-inch
- `surface-pro`: Microsoft Surface Pro

### Mobile
- `iphone-14-pro-max`: iPhone 14 Pro Max
- `iphone-14-pro`: iPhone 14 Pro
- `iphone-se`: iPhone SE (3rd generation)
- `pixel-7-pro`: Google Pixel 7 Pro
- `galaxy-s23-ultra`: Samsung Galaxy S23 Ultra

### Example with viewport preset:
```json
{
  "tool": "captureScreenshot",
  "params": {
    "url": "https://example.com",
    "viewport": {
      "preset": "iphone-14-pro"
    }
  }
}
```

## Retry Policy

The tools automatically retry on transient failures with exponential backoff. Default retryable conditions:
- HTTP status codes: 500, 502, 503, 504, 408, 429
- Network errors: ETIMEDOUT, ECONNRESET, ENOTFOUND, ECONNREFUSED
- DNS resolution failures

### Example with custom retry policy:
```json
{
  "tool": "captureScreenshot",
  "params": {
    "url": "https://example.com",
    "retryPolicy": {
      "maxRetries": 5,
      "initialDelayMs": 2000,
      "backoffMultiplier": 1.5
    }
  }
}
```

## Telemetry

The server emits structured telemetry events that can be consumed for monitoring and observability:

### Event Types
- `tool.invoked`: Tool execution started
- `tool.completed`: Tool execution succeeded
- `tool.failed`: Tool execution failed
- `navigation.started`: Page navigation initiated
- `navigation.completed`: Page navigation succeeded
- `navigation.failed`: Page navigation failed
- `retry.attempt`: Retry attempt started
- `retry.succeeded`: Retry succeeded
- `browser.launched`: Puppeteer browser started
- `browser.closed`: Puppeteer browser closed
- `screenshot.captured`: Screenshot taken
- `dom.extracted`: DOM content extracted

### Configuring Telemetry

You can configure telemetry hooks programmatically:

```typescript
import { getGlobalTelemetry } from "mcp-page-capture";

const telemetry = getGlobalTelemetry();

// Configure HTTP sink for centralized collection
telemetry.configureHttpSink({
  url: "https://telemetry.example.com/events",
  headers: { "X-API-Key": "your-api-key" },
  batchSize: 100,
  flushIntervalMs: 5000,
});

// Register custom hooks
telemetry.registerHook({
  name: "custom-logger",
  enabled: true,
  handler: async (event) => {
    console.log(`[${event.type}]`, event.data);
  },
});
```

## Storage Backends

Captures can be automatically saved to configurable storage backends:

### Local Filesystem
```typescript
import { registerStorageTarget, LocalStorageTarget } from "mcp-page-capture";

const localStorage = new LocalStorageTarget("/path/to/captures");
registerStorageTarget("local", localStorage);
```

### S3-Compatible Storage
```typescript
import { registerStorageTarget, S3StorageTarget } from "mcp-page-capture";

const s3Storage = new S3StorageTarget({
  bucket: "my-captures",
  prefix: "screenshots/",
  region: "us-west-2",
});
registerStorageTarget("s3", s3Storage);
```

### Memory Storage
```typescript
import { registerStorageTarget, MemoryStorageTarget } from "mcp-page-capture";

const memoryStorage = new MemoryStorageTarget();
registerStorageTarget("memory", memoryStorage);
```

Then use the storage in tool invocations:
```json
{
  "tool": "captureScreenshot",
  "params": {
    "url": "https://example.com",
    "storageTarget": "s3"
  }
}
```

## Known limitations
- Dynamic pages requiring complex authentication flows or user gestures are not yet automated
- Extremely long or infinite-scroll pages may exceed default Chromium memory limits
- S3 storage backend requires AWS SDK integration (placeholder implementation included)


## Automated Releases & Distribution

### npm Package
- Release automation is powered by [semantic-release](https://semantic-release.gitbook.io/semantic-release/) and GitHub Actions
- Commits must follow the Conventional Commits spec (`feat:`, `fix:`, `chore:`) for automatic versioning
- Publishes to npm registry on successful builds from `main` branch

### Docker Images
- Multi-platform images (linux/amd64, linux/arm64) are automatically built and published
- Images are pushed to:
  - Docker Hub: `<username>/mcp-page-capture`
  - GitHub Container Registry: `ghcr.io/<org>/mcp-page-capture`
- Tagged with semantic version, major, major.minor, and latest

### Required Repository Secrets
Configure these secrets in your GitHub repository settings:
- `NPM_TOKEN`: npm access token with publish permissions
- `DOCKER_USERNAME`: Docker Hub username
- `DOCKER_PASSWORD`: Docker Hub access token

The `GITHUB_TOKEN` is provided automatically by GitHub Actions.

## How to contribute
Read `CONTRIBUTING.md`, open an issue describing the change, and submit a PR that includes `npm run build` output plus updated docs/tests.

## Author / Maintainer
Maintained by **Saurabh Chase (@chasesaurabh)**. Reach out via issues or discussions for roadmap coordination.

## License
Released under the [MIT License](LICENSE).
