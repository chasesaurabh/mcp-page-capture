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
- ⚙️ **LLM-optimized schema** with minimal parameters exposed and sensible defaults
- 🔍 Structured DOM extraction with optional CSS selectors for AI-friendly consumption
- 📱 Device presets for mobile emulation (iPhone, iPad, Android, desktop)
- 🎯 **6 simplified steps** for LLM friendliness: `viewport`, `wait`, `fill`, `click`, `scroll`, `screenshot`
- 🤖 **Smart defaults** - screenshot auto-captured, field types auto-detected
- 🆕 **Consistent parameters** - `target` for elements, `for` for waiting, `to` for scrolling, `device` for viewport
- 🔄 Automatic retry with exponential backoff for transient failures
- 📊 Telemetry hooks for centralized observability and monitoring
- 💾 Pluggable storage backends (local filesystem, S3, memory)
- 🛡️ Structured logging plus defensive error handling for operational visibility
- 🔌 Launch via `npm start`, `npm run dev`, or as a long-lived MCP sidecar
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

## 🌟 LLM-Friendly Features

### Simplified Schema (5-Star LLM Rating)
- ✅ Only 4 top-level parameters: `url`, `steps`, `headers`, `validate`
- ✅ Exactly 6 step types (no more, no less)
- ✅ Consistent parameter naming across all steps
- ✅ Automatic screenshot if omitted
- ✅ Smart field type detection
- ✅ Actionable error messages with recovery suggestions
- ✅ Single source of truth for all schemas
- ✅ Deprecation warnings for legacy parameters
- ✅ **NEW**: Validate mode for pre-flight step checking
- ✅ **NEW**: Step order enforcement with auto-correction
- ✅ **NEW**: Embedded LLM reference in MCP server instructions

### Quick Start for LLMs

See **[LLM Quick Reference](docs/LLM_REFERENCE.md)** for the 6 primary step types and common patterns.

For advanced features, see **[Advanced Steps](docs/ADVANCED_STEPS.md)**.

### The 6 Step Types (Exactly 6, No More)

| Step | Purpose | Key Parameters | Example |
|------|---------|----------------|--------|
| `viewport` | Set device | `device`, `width`, `height` | `{ "type": "viewport", "device": "mobile" }` |
| `wait` | Wait for element/time | `for` OR `duration`, `timeout` | `{ "type": "wait", "for": ".loaded" }` |
| `fill` | Fill form field | `target`, `value`, `submit` | `{ "type": "fill", "target": "#email", "value": "a@b.com" }` |
| `click` | Click element | `target`, `waitFor` | `{ "type": "click", "target": "button", "waitFor": ".result" }` |
| `scroll` | Scroll page | `to`, `y` | `{ "type": "scroll", "to": "#footer" }` |
| `screenshot` | Capture (auto-added) | `fullPage`, `element` | `{ "type": "screenshot", "fullPage": true }` |

**Step Order**: Auto-fixed! `viewport` auto-moves to first, `screenshot` auto-added at end.

### Composite Patterns (NEW)

High-level patterns that auto-expand to multiple steps:

```json
// Login pattern
{
  "type": "login",
  "email": { "selector": "#email", "value": "user@example.com" },
  "password": { "selector": "#password", "value": "secret" },
  "submit": "button[type=submit]",
  "successIndicator": ".dashboard"
}

// Search pattern  
{
  "type": "search",
  "input": "#search-box",
  "query": "MCP protocol",
  "resultsIndicator": ".search-results"
}
```

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

## IDE MCP configuration

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

Note: You may need to use the full path to `dist/cli.js` or `node` depending on your working directory and Node.js module resolution configuration.

## Programmatic usage

If you want to embed the server inside another Node.js process, import the helpers exposed by the package:

```ts
import { startMcpPageCaptureServer } from "mcp-page-capture";

await startMcpPageCaptureServer();
// Optionally pass a custom Transport implementation if you don't want stdio.
```

## Usage

### Tool invocation examples

#### Basic Screenshot
```json
{
  "tool": "captureScreenshot",
  "params": {
    "url": "https://example.com"
  }
}
```
> Note: A screenshot is automatically captured at the end if no explicit screenshot step is provided.

#### Search with Fill Step (Recommended)
The `fill` step auto-detects field types and handles text inputs, selects, checkboxes, and radio buttons.

```json
{
  "tool": "captureScreenshot",
  "params": {
    "url": "https://example.com",
    "steps": [
      { "type": "fill", "target": "#search", "value": "MCP protocol", "submit": true },
      { "type": "wait", "for": ".search-results" },
      { "type": "screenshot" }
    ]
  }
}
```

#### Login Form Example
```json
{
  "tool": "captureScreenshot",
  "params": {
    "url": "https://example.com/login",
    "steps": [
      { "type": "wait", "for": "#login-form" },
      { "type": "fill", "target": "#email", "value": "user@example.com" },
      { "type": "fill", "target": "#password", "value": "secretpassword" },
      { "type": "fill", "target": "#remember-me", "value": "true" },
      { "type": "click", "target": "button[type=submit]", "waitFor": ".dashboard" },
      { "type": "screenshot" }
    ]
  }
}
```

#### Full Page Screenshot
```json
{
  "tool": "captureScreenshot",
  "params": {
    "url": "https://docs.modelcontextprotocol.io",
    "steps": [
      { "type": "screenshot", "fullPage": true }
    ]
  }
}
```

#### With Authentication and Cookies
```json
{
  "tool": "captureScreenshot",
  "params": {
    "url": "https://example.com/dashboard",
    "headers": {
      "authorization": "Bearer dev-token"
    },
    "steps": [
      {
        "type": "cookie",
        "action": "set",
        "name": "session",
        "value": "abc123",
        "path": "/secure"
      },
      { "type": "screenshot" }
    ]
  }
}
```

#### Extract DOM Content
```json
{
  "tool": "extractDom",
  "params": {
    "url": "https://docs.modelcontextprotocol.io",
    "selector": "main article"
  }
}
```

#### Mobile Device Emulation
```json
{
  "tool": "captureScreenshot",
  "params": {
    "url": "https://example.com",
    "steps": [
      { "type": "viewport", "device": "ipad-pro" },
      { "type": "scroll", "to": "#main-content" },
      { "type": "screenshot" }
    ]
  }
}
```

### Step Types

#### 6 Primary Steps (LLM-Exposed)

These are the **only** steps exposed to LLMs. They cover 95%+ of use cases:

| Step | Purpose | Parameters |
|------|---------|------------|
| `viewport` | Set device/screen size | `device`, `width`, `height` |
| `wait` | Wait for element/time | `for` OR `duration`, `timeout` |
| `fill` | Fill form field | `target`, `value`, `submit` |
| `click` | Click element | `target`, `waitFor` |
| `scroll` | Scroll page | `to` (selector), `y` (pixels) |
| `screenshot` | Capture (auto-added) | `fullPage`, `element` |

#### Validate Mode (NEW)

Use `validate: true` to check steps before execution:

```json
{
  "tool": "captureScreenshot",
  "params": {
    "url": "https://example.com",
    "steps": [
      { "type": "fill", "target": "#email", "value": "test@example.com" },
      { "type": "click", "target": "button" }
    ],
    "validate": true
  }
}
```

Returns validation analysis including:
- **Errors**: Missing required parameters
- **Warnings**: Step order issues (e.g., viewport not first)
- **Suggestions**: Recommended improvements (e.g., add `waitFor` to click)
- **Step analysis**: Per-step status and notes

#### Deprecated Steps (Legacy Support Only)

These work at runtime but are **not exposed in the LLM schema**. Use the 6 primary steps instead:

| Deprecated | Use Instead |
|------------|-------------|
| `quickFill` | `fill` with `submit: true` |
| `fillForm` | Multiple `fill` steps |
| `waitForSelector` | `wait` with `for` parameter |
| `delay` | `wait` with `duration` parameter |
| `fullPage` | `screenshot` with `fullPage: true` |

#### Internal Steps (Not Exposed)

These are for power users only and are not documented in the tool schema:

`type`, `hover`, `cookie`, `storage`, `evaluate`, `keypress`, `focus`, `blur`, `clear`, `upload`, `submit`

### Legacy Parameter Support

For backward compatibility, these parameters work at runtime but are **not exposed in the LLM schema**:

| Legacy Parameter | Canonical | Notes |
|-----------------|-----------|-------|
| `selector` | `target` | Use `target` for element selectors |
| `awaitElement` | `for` | Use `for` in wait steps |
| `scrollTo` | `to` | Use `to` in scroll steps |
| `preset` | `device` | Use `device` in viewport steps |
| `captureElement` | `element` | Use `element` in screenshot steps |
| `waitAfter` | `wait` | Use `wait` in click steps |

**Deprecation warnings** are logged when legacy parameters are used.

### Example response
```json
{
  "content": [
    {
      "type": "text",
      "text": "mcp-page-capture screenshot\nURL: https://example.com\nCaptured: 2025-12-13T08:30:12.713Z\nFull page: false\nViewport: 1280x720\nDocument: 1280x2000\nScroll position: (0, 0)\nSize: 45.2 KB\nSteps executed: 5"
    },
    {
      "type": "image",
      "mimeType": "image/png",
      "data": "iVBORw0KGgoAAAANSUhEUgA..."
    }
  ]
}

## Supported options

### `captureScreenshot`
- `url` (string, required): Fully-qualified URL to capture
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

### Fill Form (`fillForm`) - Recommended for Form Interactions
The `fillForm` step is the easiest and most LLM-friendly way to interact with forms. It auto-detects field types and handles multiple fields in a single step.

```json
{
  "type": "fillForm",
  "fields": [
    { "selector": "#email", "value": "user@example.com" },
    { "selector": "#password", "value": "secretpassword" },
    { "selector": "#country", "value": "us" },
    { "selector": "#newsletter", "value": "true" },
    { "selector": "#plan", "value": "premium", "type": "radio" }
  ],
  "formSelector": "#signup-form",
  "submit": true,
  "submitSelector": "#submit-btn",
  "waitForNavigation": true
}
```

#### Field Configuration
Each field in the `fields` array supports:
- `selector` (required): CSS selector for the form field
- `value` (required): Value to set. For checkboxes use `"true"` or `"false"`. For selects/radios use the value attribute.
- `type` (optional): Field type hint (`text`, `select`, `checkbox`, `radio`, `textarea`, `password`, `email`, `number`, `tel`, `url`, `date`, `file`). Auto-detected if not specified.
- `matchByText` (optional): For select fields, match by visible text instead of value attribute
- `delay` (optional): Delay between keystrokes in ms (for text inputs)

#### Form Options
- `formSelector` (optional): CSS selector for the form container (for scoping field selectors)
- `submit` (optional): Whether to submit the form after filling (default: false)
- `submitSelector` (optional): Selector for submit button. If not specified, uses form.submit() or looks for `[type="submit"]`
- `waitForNavigation` (optional): Whether to wait for navigation after submit (default: true)

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
  "target": "button.submit",
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
  "scrollTo": "#section-2",  // Scroll to element (takes precedence)
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

### Wait for Selector (`waitForSelector`) - DEPRECATED
Use `wait` step instead:
```json
{ "type": "wait", "for": ".loading-complete", "timeout": 10000 }
```

### Delay (`delay`) - DEPRECATED
Use `wait` step with `duration` instead:
```json
{ "type": "wait", "duration": 2000 }
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
  "captureElement": ".specific-element"  // Capture specific element (optional)
}
```

### Cookie Management (`cookie`)
Set or delete browser cookies:
```json
{
  "type": "cookie",
  "action": "set",
  "name": "session_id",
  "value": "abc123",
  "domain": ".example.com",
  "path": "/",
  "secure": true
}
```
Supported actions: `set` (add/update cookie), `delete` (remove cookie).

### Storage Management (`storage`)
Manage localStorage/sessionStorage:
```json
{
  "type": "storage",
  "storageType": "localStorage",
  "action": "set",
  "key": "user_preferences",
  "value": "{\"theme\":\"dark\"}"
}
```
Supported actions: `set` (add/update), `delete` (remove key), `clear` (remove all items).

### Example: Complex Form Interaction with Screenshot
```json
{
  "tool": "captureScreenshot",
  "params": {
    "url": "https://example.com/signup",
    "steps": [
      { "type": "waitForSelector", "awaitElement": "#signup-form" },
      { "type": "text", "selector": "#email", "value": "user@example.com" },
      { "type": "text", "selector": "#password", "value": "SecurePass123!" },
      { "type": "select", "selector": "#country", "text": "United States" },
      { "type": "radio", "selector": "input[name='plan']", "value": "premium" },
      { "type": "checkbox", "selector": "#newsletter", "checked": true },
      { "type": "checkbox", "selector": "#terms", "checked": true },
      { "type": "hover", "selector": ".tooltip-trigger", "duration": 500 },
      { "type": "scroll", "y": 200 },
      { "type": "click", "target": "button[type='submit']", "waitForNavigation": true },
      { "type": "delay", "duration": 2000 },
      { "type": "screenshot", "fullPage": true }
    ]
  }
}
```

## Troubleshooting

If your capture fails, use these guidelines:

| Error | Solution |
|-------|----------|
| "element not found" | Check CSS selector, add `waitForSelector` before `click`/`fillForm` |
| "navigation timeout" | Increase `retryPolicy.maxRetries` or add `delay` step |
| "page not loaded" | Add `waitForSelector` or `delay` before `screenshot` |
| "click failed" | Ensure element is visible, add `scroll` to bring it into view |

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
