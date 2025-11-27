import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { createLogger, type LogLevel, type Logger } from "./logger.js";
import { registerCaptureScreenshotTool } from "./tools/captureScreenshot.js";
import { registerExtractDomTool } from "./tools/extractDom.js";

export interface CreateServerOptions {
  logger?: Logger;
}

export interface CreateServerResult {
  server: McpServer;
  logger: Logger;
}

export function createPageCaptureServer(options: CreateServerOptions = {}): CreateServerResult {
  const resolvedLevel = (process.env.LOG_LEVEL as LogLevel) || "info";
  const logger = options.logger ?? createLogger(resolvedLevel);

  const server = new McpServer(
    {
      name: "mcp-page-capture",
      version: process.env.npm_package_version || "1.0.0",
    },
    {
      instructions: "Capture high-fidelity webpage screenshots with optional full-page rendering.",
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
