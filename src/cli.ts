#!/usr/bin/env node

import { startMcpPageCaptureServer } from "./server.js";

startMcpPageCaptureServer().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("mcp-page-capture failed to start", message);
  process.exitCode = 1;
});
