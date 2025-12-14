import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { createLogger, type LogLevel, type Logger } from "./logger.js";
import { registerCaptureScreenshotTool } from "./tools/captureScreenshot.js";
import { registerExtractDomTool } from "./tools/extractDom.js";
import packageJson from "../package.json" with { type: "json" };

export interface CreateServerOptions {
  logger?: Logger;
}

export interface CreateServerResult {
  server: McpServer;
  logger: Logger;
}

/**
 * MCP Server Instructions - Embedded LLM Reference
 * This is always available to LLMs using this server
 */
const MCP_INSTRUCTIONS = `# MCP Page-Capture Server

## captureScreenshot
Capture webpage screenshot with optional interactions.

**Params:** url (required), steps (optional), headers (optional), validate (optional)

**6 Steps (order auto-fixed, screenshot auto-added):**

| Step | Key Params | Example |
|------|------------|---------|
| viewport | device | { "type": "viewport", "device": "mobile" } |
| wait | for OR duration | { "type": "wait", "for": ".loaded" } or { "type": "wait", "duration": 2000 } |
| fill | target, value | { "type": "fill", "target": "#email", "value": "a@b.com" } |
| click | target, waitFor | { "type": "click", "target": "#btn", "waitFor": ".result" } |
| scroll | to or y | { "type": "scroll", "to": "#footer" } |
| screenshot | fullPage, element | { "type": "screenshot", "fullPage": true } |

**Composite Patterns (expand automatically):**
- login: { "type": "login", "email": { "selector": "#email", "value": "..." }, "password": { "selector": "#pass", "value": "..." }, "submit": "#btn", "successIndicator": ".dashboard" }
- search: { "type": "search", "input": "#search", "query": "...", "resultsIndicator": ".results" }

**Devices:** mobile, tablet, desktop, iphone-16-pro, pixel-9, galaxy-s24, ipad-pro

**Error Recovery:**
- ELEMENT_NOT_FOUND → Add { "type": "wait", "for": "<selector>" } BEFORE failing step
- ELEMENT_NOT_VISIBLE → Add { "type": "scroll", "to": "<selector>" } BEFORE failing step

## extractDom
Extract HTML/text/DOM structure. Use for text analysis or selector discovery.

**Params:** url (required), selector (optional - scope extraction)
`;

export function createPageCaptureServer(options: CreateServerOptions = {}): CreateServerResult {
  const resolvedLevel = (process.env.LOG_LEVEL as LogLevel) || "info";
  const logger = options.logger ?? createLogger(resolvedLevel);

  const server = new McpServer(
    {
      name: "mcp-page-capture",
      version: packageJson.version,
    },
    {
      instructions: MCP_INSTRUCTIONS,
    },
  );

  registerCaptureScreenshotTool(server, logger);
  registerExtractDomTool(server, logger);

  return { server, logger };
}

export interface StartServerOptions extends CreateServerOptions {
  transport?: Transport;
}

export interface StartServerResult extends CreateServerResult {
  transport: Transport;
}

export async function startMcpPageCaptureServer(options: StartServerOptions = {}): Promise<StartServerResult> {
  const transport = options.transport ?? new StdioServerTransport();
  const { server, logger } = createPageCaptureServer({ logger: options.logger });

  logger.info("mcp-page-capture starting");
  await server.connect(transport);
  logger.info("mcp-page-capture ready to accept requests");

  return { server, transport, logger };
}
