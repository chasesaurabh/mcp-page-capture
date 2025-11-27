import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

import {
  mockBrowser,
  mockPage,
  queueEvaluateResult,
  resetPuppeteerMock,
  setGotoFailure,
  setScreenshotBuffer,
} from "../helpers/puppeteerMock.js";
import { registerCaptureScreenshotTool } from "../../src/tools/captureScreenshot.js";
import { registerExtractDomTool } from "../../src/tools/extractDom.js";
import type { Logger } from "../../src/logger.js";

const createLogger = (): Logger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

const getToolHandler = (
  registerFn: (server: McpServer, logger: Logger) => void,
  logger: Logger,
) => {
  const registerTool = vi.fn();
  const server = { registerTool } as unknown as McpServer;
  registerFn(server, logger);
  const handler = registerTool.mock.calls[0]?.[2];
  if (!handler) {
    throw new Error("Tool handler was not registered.");
  }
  return handler as (input: any) => Promise<any>;
};

describe("captureScreenshot tool", () => {
  beforeEach(() => {
    resetPuppeteerMock();
  });

  it("returns metadata and image content while applying headers and cookies", async () => {
    const logger = createLogger();
    const handler = getToolHandler(registerCaptureScreenshotTool, logger);

    const metrics = {
      viewportWidth: 1111,
      viewportHeight: 999,
      scrollWidth: 3333,
      scrollHeight: 4444,
    };

    queueEvaluateResult(metrics);
    const imageBuffer = Buffer.from("integration-image");
    setScreenshotBuffer(imageBuffer);

    const response = await handler({
      url: "https://example.com/dashboard",
      fullPage: true,
      headers: {
        "  X-Debug  ": " token ",
      },
      cookies: [
        {
          name: " session ",
          value: "abc123",
        },
      ],
    });

    expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith({ "X-Debug": "token" });
    expect(mockPage.setCookie).toHaveBeenCalledTimes(1);
    expect(mockPage.setCookie).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "session",
        value: "abc123",
        url: "https://example.com",
      }),
    );
    expect(mockPage.screenshot).toHaveBeenCalledWith({ type: "png", fullPage: true });
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);

    expect(response.content[0]).toMatchObject({ type: "text" });
    expect(response.content[0].text).toContain("URL: https://example.com/dashboard");
    expect(response.content[0].text).toContain("Full page: true");

    expect(response.content[1]).toEqual({
      type: "image",
      mimeType: "image/png",
      data: imageBuffer.toString("base64"),
    });
  });

  it("wraps navigation failures in an McpError", async () => {
    const logger = createLogger();
    const handler = getToolHandler(registerCaptureScreenshotTool, logger);

    setGotoFailure(502);

    await expect(
      handler({ url: "https://example.com/broken", fullPage: false }),
    ).rejects.toMatchObject({
      code: ErrorCode.InvalidParams,
      data: {
        url: "https://example.com/broken",
        detail: "Navigation failed with status: 502",
      },
    });

    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });
});

describe("extractDom tool", () => {
  beforeEach(() => {
    resetPuppeteerMock();
  });

  it("returns bounded DOM content and applies request options", async () => {
    const logger = createLogger();
    const handler = getToolHandler(registerExtractDomTool, logger);

    const bigHtml = `<article>${"<span>hi</span>".repeat(50_100)}</article>`;
    const largeText = "content".repeat(20_000);
    const domTree = {
      type: "element",
      tagName: "section",
      attributes: { id: "main" },
      children: [{ type: "text", textContent: "Hello" }],
    };

    queueEvaluateResult((_: (...args: unknown[]) => unknown, params: { selector?: string }) => {
      expect(params.selector).toBe("main article");
      return {
        ok: true,
        payload: {
          html: bigHtml,
          text: largeText,
          domTree,
          nodeCount: 42,
          truncated: true,
        },
      };
    });

    const response = await handler({
      url: "https://example.org/docs",
      selector: "main article",
      headers: {
        " Accept ": " text/html ",
      },
      cookies: [
        {
          name: "auth",
          value: "token",
          domain: "example.org",
        },
      ],
    });

    expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith({ Accept: "text/html" });
    expect(mockPage.setCookie).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "auth",
        domain: "example.org",
        path: "/",
      }),
    );

    const [summary, htmlBlock, textBlock, domBlock] = response.content;
    expect(summary.text).toContain("Selector: main article");
    expect(summary.text).toContain("Nodes serialized: 42 (truncated)");
    expect(summary.text).toContain("HTML truncated: true");
    expect(summary.text).toContain("Text truncated: true");

    expect(htmlBlock.text.startsWith("HTML (truncated):")).toBe(true);
    expect(textBlock.text.startsWith("Text (truncated):")).toBe(true);
    expect(domBlock.text).toContain('"tagName": "section"');
  });

  it("surfaced DOM extraction failures as McpErrors", async () => {
    const logger = createLogger();
    const handler = getToolHandler(registerExtractDomTool, logger);

    queueEvaluateResult({ ok: false, error: "No element matched selector" });

    await expect(
      handler({ url: "https://example.org", selector: "nav.primary" }),
    ).rejects.toSatisfy((error) => {
      expect(error).toBeInstanceOf(McpError);
      expect(error).toMatchObject({
        code: ErrorCode.InvalidParams,
        data: {
          detail: "No element matched selector",
          url: "https://example.org",
        },
      });
      return true;
    });
  });
});
