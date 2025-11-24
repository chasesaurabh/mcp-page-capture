import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createLogger } from "./logger.js";
import { registerCaptureScreenshotTool } from "./tools/captureScreenshot.js";

const logger = createLogger(process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error" || "info");

const server = new McpServer(
  {
    name: "pagecapture-mcp",
    version: process.env.npm_package_version || "1.0.0",
  },
  {
    instructions: "Capture high-fidelity webpage screenshots with optional full-page rendering.",
  },
);

registerCaptureScreenshotTool(server, logger);

async function main() {
  logger.info("mcp-page-capture starting");

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("mcp-page-capture ready to accept requests");
}

main().catch((error) => {
  logger.error("Fatal error", { error: (error as Error).message });
  process.exitCode = 1;
});
