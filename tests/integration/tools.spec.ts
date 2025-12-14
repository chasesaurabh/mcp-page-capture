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
  setWaitForSelectorFailure,
  setCookiesImpl,
  setElementSelectorNotFound,
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
      headers: {
        "  X-Debug  ": " token ",
      },
      cookies: [
        {
          name: " session ",
          value: "abc123",
        },
      ],
      steps: [
        { type: "fullPage", enabled: true },
        { type: "screenshot" },
      ],
    });

    expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith({ "X-Debug": "token" });
    expect(mockPage.setCookie).toHaveBeenCalledTimes(1);
    expect(mockPage.setCookie).toHaveBeenCalledWith(
      expect.objectContaining({
        name: " session ",
        value: "abc123",
      }),
    );
    expect(mockPage.screenshot).toHaveBeenCalledWith({ type: "png", fullPage: true });
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);

    expect(response.content[0]).toMatchObject({ type: "text" });
    expect(response.content[0].text).toContain("URL: https://example.com/dashboard");
    // 3 steps: cookie (from legacy), fullPage, screenshot
    expect(response.content[0].text).toContain("Steps executed: 3");

    expect(response.content[1]).toEqual({
      type: "image",
      mimeType: "image/png",
      data: imageBuffer.toString("base64"),
    });
  });

  it("wraps navigation failures in an McpError", async () => {
    const logger = createLogger();
    const handler = getToolHandler(registerCaptureScreenshotTool, logger);

    setGotoFailure(400);  // Use non-retryable status code

    await expect(
      handler({ url: "https://example.com/broken" }),
    ).rejects.toMatchObject({
      code: ErrorCode.InvalidParams,
      data: {
        url: "https://example.com/broken",
        detail: "Navigation failed with status: 400",
      },
    });

    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it("scrolls to specified coordinates before capturing screenshot", async () => {
    const logger = createLogger();
    const handler = getToolHandler(registerCaptureScreenshotTool, logger);

    // Queue evaluate results for steps-based flow: scrollTo, then metrics
    queueEvaluateResult(undefined); // scrollTo returns void
    queueEvaluateResult({
      viewportWidth: 1280,
      viewportHeight: 720,
      scrollWidth: 2000,
      scrollHeight: 3000,
      scrollX: 100,
      scrollY: 500,
    });

    const imageBuffer = Buffer.from("scroll-test-image");
    setScreenshotBuffer(imageBuffer);

    const response = await handler({
      url: "https://example.com/long-page",
      scroll: {
        x: 100,
        y: 500,
      },
    });

    expect(mockPage.evaluate).toHaveBeenCalled();
    expect(response.content[0].text).toContain("Scroll position: (100, 500)");
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it("scrolls to element by selector before capturing screenshot", async () => {
    const logger = createLogger();
    const handler = getToolHandler(registerCaptureScreenshotTool, logger);

    // Queue evaluate results: scroll to selector result, final metrics
    queueEvaluateResult({ ok: true, x: 0, y: 800 }); // scrollIntoView result
    queueEvaluateResult({
      viewportWidth: 1280,
      viewportHeight: 720,
      scrollWidth: 1280,
      scrollHeight: 2500,
      scrollX: 0,
      scrollY: 800,
    });

    const imageBuffer = Buffer.from("selector-scroll-image");
    setScreenshotBuffer(imageBuffer);

    const response = await handler({
      url: "https://example.com/article",
      scroll: {
        selector: "#section-3",
      },
    });

    expect(mockPage.evaluate).toHaveBeenCalled();
    expect(response.content[0].text).toContain("Scroll position: (0, 800)");
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it("handles scroll with smooth behavior", async () => {
    const logger = createLogger();
    const handler = getToolHandler(registerCaptureScreenshotTool, logger);

    // Queue evaluate results for steps-based flow: scrollTo, then metrics
    queueEvaluateResult(undefined); // scrollTo returns void
    queueEvaluateResult({
      viewportWidth: 1280,
      viewportHeight: 720,
      scrollWidth: 1280,
      scrollHeight: 5000,
      scrollX: 0,
      scrollY: 1000,
    });

    const imageBuffer = Buffer.from("smooth-scroll-image");
    setScreenshotBuffer(imageBuffer);

    const response = await handler({
      url: "https://example.com/smooth",
      scroll: {
        y: 1000,
        behavior: "smooth",
      },
    });

    expect(response.content[0].text).toContain("Scroll position: (0, 1000)");
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it("gracefully handles selector not found during scroll", async () => {
    const logger = createLogger();
    const handler = getToolHandler(registerCaptureScreenshotTool, logger);

    // Queue evaluate results: selector not found, final metrics
    queueEvaluateResult({ ok: false, error: "Element not found: #nonexistent" });
    queueEvaluateResult({
      viewportWidth: 1280,
      viewportHeight: 720,
      scrollWidth: 1280,
      scrollHeight: 1000,
      scrollX: 0,
      scrollY: 0,
    });

    const imageBuffer = Buffer.from("no-scroll-image");
    setScreenshotBuffer(imageBuffer);

    const response = await handler({
      url: "https://example.com/page",
      scroll: {
        selector: "#nonexistent",
      },
    });

    // Should still capture screenshot but with scroll at 0,0
    expect(response.content[0].text).toContain("Scroll position: (0, 0)");
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it("executes click actions before taking screenshot", async () => {
    const logger = createLogger();
    const handler = getToolHandler(registerCaptureScreenshotTool, logger);

    queueEvaluateResult({
      viewportWidth: 1280,
      viewportHeight: 720,
      scrollWidth: 1280,
      scrollHeight: 1000,
      scrollX: 0,
      scrollY: 0,
    });

    const imageBuffer = Buffer.from("click-action-image");
    setScreenshotBuffer(imageBuffer);

    const response = await handler({
      url: "https://example.com/modal",
      clickActions: [
        { selector: ".open-modal-btn" },
      ],
    });

    expect(mockPage.waitForSelector).toHaveBeenCalledWith(".open-modal-btn", { timeout: 10000 });
    expect(mockPage.click).toHaveBeenCalledWith(".open-modal-btn", {});
    expect(response.content[0].text).toContain("Steps executed:");
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it("executes multiple click actions in sequence", async () => {
    const logger = createLogger();
    const handler = getToolHandler(registerCaptureScreenshotTool, logger);

    queueEvaluateResult({
      viewportWidth: 1280,
      viewportHeight: 720,
      scrollWidth: 1280,
      scrollHeight: 1000,
      scrollX: 0,
      scrollY: 0,
    });

    const imageBuffer = Buffer.from("multi-click-image");
    setScreenshotBuffer(imageBuffer);

    const response = await handler({
      url: "https://example.com/carousel",
      clickActions: [
        { selector: ".carousel-next" },
        { selector: ".carousel-next" },
        { selector: ".carousel-next" },
      ],
    });

    expect(mockPage.waitForSelector).toHaveBeenCalledTimes(3);
    expect(mockPage.click).toHaveBeenCalledTimes(3);
    expect(response.content[0].text).toContain("Steps executed:");
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it("handles click action with delayBefore and delayAfter", async () => {
    const logger = createLogger();
    const handler = getToolHandler(registerCaptureScreenshotTool, logger);

    queueEvaluateResult({
      viewportWidth: 1280,
      viewportHeight: 720,
      scrollWidth: 1280,
      scrollHeight: 1000,
      scrollX: 0,
      scrollY: 0,
    });

    const imageBuffer = Buffer.from("delay-click-image");
    setScreenshotBuffer(imageBuffer);

    const startTime = Date.now();
    const response = await handler({
      url: "https://example.com/animated",
      clickActions: [
        { selector: ".animated-btn", delayBefore: 50, delayAfter: 50 },
      ],
    });
    const elapsed = Date.now() - startTime;

    expect(mockPage.click).toHaveBeenCalledWith(".animated-btn", {});
    expect(response.content[0].text).toContain("Steps executed:");
    // Should have waited at least 100ms (50ms before + 50ms after)
    expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some tolerance
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it("handles click action with waitForSelector after click", async () => {
    const logger = createLogger();
    const handler = getToolHandler(registerCaptureScreenshotTool, logger);

    queueEvaluateResult({
      viewportWidth: 1280,
      viewportHeight: 720,
      scrollWidth: 1280,
      scrollHeight: 1000,
      scrollX: 0,
      scrollY: 0,
    });

    const imageBuffer = Buffer.from("wait-selector-image");
    setScreenshotBuffer(imageBuffer);

    const response = await handler({
      url: "https://example.com/modal",
      clickActions: [
        { selector: ".open-modal-btn", waitForSelector: ".modal-content" },
      ],
    });

    expect(mockPage.waitForSelector).toHaveBeenCalledWith(".open-modal-btn", { timeout: 10000 });
    expect(mockPage.click).toHaveBeenCalledWith(".open-modal-btn", {});
    expect(mockPage.waitForSelector).toHaveBeenCalledWith(".modal-content", { timeout: 10000 });
    expect(response.content[0].text).toContain("Steps executed:");
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it("handles click action with button and clickCount options", async () => {
    const logger = createLogger();
    const handler = getToolHandler(registerCaptureScreenshotTool, logger);

    queueEvaluateResult({
      viewportWidth: 1280,
      viewportHeight: 720,
      scrollWidth: 1280,
      scrollHeight: 1000,
      scrollX: 0,
      scrollY: 0,
    });

    const imageBuffer = Buffer.from("double-click-image");
    setScreenshotBuffer(imageBuffer);

    const response = await handler({
      url: "https://example.com/doubleclick",
      clickActions: [
        { selector: ".item", button: "left", clickCount: 2 },
      ],
    });

    expect(mockPage.click).toHaveBeenCalledWith(".item", { button: "left", clickCount: 2 });
    expect(response.content[0].text).toContain("Steps executed:");
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it("continues with remaining click actions when one fails", async () => {
    const logger = createLogger();
    const handler = getToolHandler(registerCaptureScreenshotTool, logger);

    // Make the first selector fail
    setWaitForSelectorFailure(".nonexistent-btn");

    queueEvaluateResult({
      viewportWidth: 1280,
      viewportHeight: 720,
      scrollWidth: 1280,
      scrollHeight: 1000,
      scrollX: 0,
      scrollY: 0,
    });

    const imageBuffer = Buffer.from("partial-click-image");
    setScreenshotBuffer(imageBuffer);

    const response = await handler({
      url: "https://example.com/partial",
      clickActions: [
        { selector: ".nonexistent-btn" },
        { selector: ".existing-btn" },
      ],
    });

    // First action fails, second succeeds
    expect(mockPage.click).toHaveBeenCalledTimes(1);
    expect(mockPage.click).toHaveBeenCalledWith(".existing-btn", {});
    expect(response.content[0].text).toContain("Steps executed:");
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it("does not include click actions in metadata when none executed", async () => {
    const logger = createLogger();
    const handler = getToolHandler(registerCaptureScreenshotTool, logger);

    queueEvaluateResult({
      viewportWidth: 1280,
      viewportHeight: 720,
      scrollWidth: 1280,
      scrollHeight: 1000,
      scrollX: 0,
      scrollY: 0,
    });

    const imageBuffer = Buffer.from("no-click-image");
    setScreenshotBuffer(imageBuffer);

    const response = await handler({
      url: "https://example.com/simple",
    });

    expect(mockPage.click).not.toHaveBeenCalled();
    // With the new steps system, an auto-screenshot step is always added
    expect(response.content[0].text).toContain("Steps executed: 1");
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  // Steps-based action tests
  describe("steps pattern", () => {
    it("executes delay step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("delay-step-image");
      setScreenshotBuffer(imageBuffer);

      const startTime = Date.now();
      const response = await handler({
        url: "https://example.com/delay",
          steps: [
          { type: "delay", duration: 100 },
          { type: "screenshot" },
        ],
      });
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes click step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("click-step-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/click",
          steps: [
          { type: "click", target: ".btn" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.waitForSelector).toHaveBeenCalledWith(".btn", { timeout: 10000 });
      expect(mockPage.click).toHaveBeenCalledWith(".btn", {});
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes scroll step with coordinates", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      // Queue evaluate results: scrollTo, then metrics
      queueEvaluateResult(undefined);
      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 2000,
        scrollHeight: 3000,
        scrollX: 100,
        scrollY: 500,
      });

      const imageBuffer = Buffer.from("scroll-step-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/scroll",
          steps: [
          { type: "scroll", x: 100, y: 500 },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes scroll step with selector", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      // Queue evaluate results: scrollIntoView, then metrics
      queueEvaluateResult({ ok: true, x: 0, y: 800 });
      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 2500,
        scrollX: 0,
        scrollY: 800,
      });

      const imageBuffer = Buffer.from("scroll-selector-step-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/scroll-selector",
          steps: [
          { type: "scroll", scrollTo: "#section" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes waitForSelector step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("wait-step-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/wait",
          steps: [
          { type: "waitForSelector", awaitElement: ".loaded" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.waitForSelector).toHaveBeenCalledWith(".loaded", { timeout: 10000 });
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes multiple steps in sequence", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      // Queue evaluate results: scroll, then metrics
      queueEvaluateResult(undefined);
      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 2000,
        scrollX: 0,
        scrollY: 500,
      });

      const imageBuffer = Buffer.from("multi-step-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/multi",
          steps: [
          { type: "delay", duration: 50 },
          { type: "click", target: ".open-btn" },
          { type: "waitForSelector", awaitElement: ".modal" },
          { type: "scroll", y: 500 },
          { type: "screenshot" },
          { type: "delay", duration: 50 },
        ],
      });

      expect(mockPage.click).toHaveBeenCalledWith(".open-btn", {});
      expect(mockPage.waitForSelector).toHaveBeenCalledWith(".modal", { timeout: 10000 });
      expect(response.content[0].text).toContain("Steps executed: 6");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("takes screenshot automatically if no screenshot step is provided", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("auto-screenshot-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/auto",
          steps: [
          { type: "delay", duration: 50 },
          { type: "click", target: ".btn" },
        ],
      });

      expect(mockPage.screenshot).toHaveBeenCalled();
      expect(response.content[0].text).toContain("Steps executed: 3");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes click step with button and clickCount options", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("click-options-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/dblclick",
          steps: [
          { type: "click", target: ".item", button: "left", clickCount: 2 },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.click).toHaveBeenCalledWith(".item", { button: "left", clickCount: 2 });
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("continues with remaining steps when one fails", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      // Make the first selector fail
      setWaitForSelectorFailure(".nonexistent");

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("partial-steps-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/partial",
          steps: [
          { type: "click", target: ".nonexistent" },
          { type: "click", target: ".existing" },
          { type: "screenshot" },
        ],
      });

      // First click fails, second succeeds
      expect(mockPage.click).toHaveBeenCalledTimes(1);
      expect(mockPage.click).toHaveBeenCalledWith(".existing", {});
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes screenshot step at specified position in steps", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("mid-screenshot-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/mid-screenshot",
          steps: [
          { type: "click", target: ".before-btn" },
          { type: "screenshot" },
          { type: "click", target: ".after-btn" },
        ],
      });

      // Both clicks should execute
      expect(mockPage.click).toHaveBeenCalledTimes(2);
      expect(mockPage.click).toHaveBeenNthCalledWith(1, ".before-btn", {});
      expect(mockPage.click).toHaveBeenNthCalledWith(2, ".after-btn", {});
      expect(mockPage.screenshot).toHaveBeenCalled();
      expect(response.content[0].text).toContain("Steps executed: 3");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes screenshot step with fullPage override", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 2000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("fullpage-override-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/fullpage-override",
          steps: [
          { type: "screenshot", fullPage: true },
        ],
      });

      expect(mockPage.screenshot).toHaveBeenCalledWith({ type: "png", fullPage: true });
      expect(response.content[0].text).toContain("Steps executed: 1");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes screenshot step with selector to capture element", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("element-screenshot-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/element-screenshot",
          steps: [
          { type: "screenshot", captureElement: ".target-element" },
        ],
      });

      expect(mockPage.$).toHaveBeenCalledWith(".target-element");
      expect(response.content[0].text).toContain("Steps executed: 1");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("falls back to page screenshot when element selector not found", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      // Set up element selector to return null for the target
      setElementSelectorNotFound(".nonexistent-element");

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("fallback-screenshot-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/fallback-screenshot",
          steps: [
          { type: "screenshot", captureElement: ".nonexistent-element" },
        ],
      });

      expect(mockPage.$).toHaveBeenCalledWith(".nonexistent-element");
      expect(mockPage.screenshot).toHaveBeenCalledWith({ type: "png", fullPage: false });
      expect(response.content[0].text).toContain("Steps executed: 1");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes cookie set step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("cookie-set-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/cookie-set",
          steps: [
          { type: "cookie", action: "set", name: "session", value: "abc123" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.setCookie).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "session",
          value: "abc123",
        }),
      );
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes cookie set step with all options", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("cookie-full-options-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/cookie-full",
          steps: [
          { 
            type: "cookie", 
            action: "set", 
            name: "auth", 
            value: "token123",
            domain: "example.com",
            path: "/app",
            secure: true,
            httpOnly: true,
            sameSite: "Strict",
            expires: 1735689600,
          },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.setCookie).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "auth",
          value: "token123",
          domain: "example.com",
          path: "/app",
          secure: true,
          httpOnly: true,
          sameSite: "Strict",
          expires: 1735689600,
        }),
      );
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes cookie delete step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      // Set up cookies to return the cookie to delete
      setCookiesImpl(async () => [
        { name: "session", value: "abc123", domain: "example.com" },
      ]);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("cookie-delete-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/cookie-delete",
          steps: [
          { type: "cookie", action: "delete", name: "session" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.cookies).toHaveBeenCalled();
      expect(mockPage.deleteCookie).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "session",
          domain: "example.com",
        }),
      );
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("handles cookie delete when cookie not found", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      // Set up cookies to return empty array
      setCookiesImpl(async () => []);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("cookie-not-found-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/cookie-not-found",
          steps: [
          { type: "cookie", action: "delete", name: "nonexistent" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.cookies).toHaveBeenCalled();
      expect(mockPage.deleteCookie).not.toHaveBeenCalled();
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes localStorage set step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      // Queue evaluate results: storage operation, then metrics
      queueEvaluateResult(undefined);
      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("localstorage-set-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/storage-set",
          steps: [
          { type: "storage", storageType: "localStorage", action: "set", key: "user", value: "john" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes sessionStorage set step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      // Queue evaluate results: storage operation, then metrics
      queueEvaluateResult(undefined);
      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("sessionstorage-set-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/session-storage-set",
          steps: [
          { type: "storage", storageType: "sessionStorage", action: "set", key: "token", value: "xyz789" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes storage delete step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      // Queue evaluate results: storage operation, then metrics
      queueEvaluateResult(undefined);
      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("storage-delete-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/storage-delete",
          steps: [
          { type: "storage", storageType: "localStorage", action: "delete", key: "user" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes storage clear step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      // Queue evaluate results: storage operation, then metrics
      queueEvaluateResult(undefined);
      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("storage-clear-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/storage-clear",
          steps: [
          { type: "storage", storageType: "sessionStorage", action: "clear" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes complex workflow with all new step types", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      // Set up cookies for delete operation
      setCookiesImpl(async () => [
        { name: "old-cookie", value: "old-value", domain: "example.com" },
      ]);

      // Queue evaluate results: storage set, storage delete, then metrics
      queueEvaluateResult(undefined);
      queueEvaluateResult(undefined);
      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("complex-workflow-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/complex-workflow",
          steps: [
          { type: "cookie", action: "set", name: "auth", value: "token" },
          { type: "cookie", action: "delete", name: "old-cookie" },
          { type: "storage", storageType: "localStorage", action: "set", key: "user", value: "john" },
          { type: "storage", storageType: "sessionStorage", action: "clear" },
          { type: "click", target: ".login-btn" },
          { type: "delay", duration: 50 },
          { type: "screenshot", fullPage: true },
        ],
      });

      expect(mockPage.setCookie).toHaveBeenCalledTimes(1); // cookie set step only
      expect(mockPage.deleteCookie).toHaveBeenCalled();
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockPage.click).toHaveBeenCalledWith(".login-btn", {});
      expect(response.content[0].text).toContain("Steps executed: 7");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    // New action type tests
    it("executes text input step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("text-input-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/form",
          steps: [
          { type: "text", selector: "#username", value: "testuser" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.waitForSelector).toHaveBeenCalledWith("#username", { timeout: 5000 });
      expect(mockPage.type).toHaveBeenCalledWith("#username", "testuser", { delay: 0 });
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes text input step with pressEnter option", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("text-enter-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/search",
          steps: [
          { type: "text", selector: "#search", value: "query", pressEnter: true },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.type).toHaveBeenCalledWith("#search", "query", { delay: 0 });
      expect(mockPage.keyboard.press).toHaveBeenCalledWith("Enter");
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes select step by value", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("select-value-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/form",
          steps: [
          { type: "select", selector: "#country", value: "us" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.select).toHaveBeenCalledWith("#country", "us");
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes select step by text", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      // Queue evaluate results: select by text, then metrics
      queueEvaluateResult("us");
      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("select-text-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/form",
          steps: [
          { type: "select", selector: "#country", text: "United States" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes checkbox step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      // Queue evaluate results: checkbox check, then metrics
      queueEvaluateResult(false); // checkbox is unchecked
      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("checkbox-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/form",
          steps: [
          { type: "checkbox", selector: "#terms", checked: true },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.click).toHaveBeenCalledWith("#terms");
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes hover step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("hover-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/menu",
          steps: [
          { type: "hover", selector: ".dropdown" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.hover).toHaveBeenCalledWith(".dropdown");
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes focus step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("focus-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/form",
          steps: [
          { type: "focus", selector: "#email" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.focus).toHaveBeenCalledWith("#email");
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes blur step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      // Queue evaluate results: blur operation, then metrics
      queueEvaluateResult(undefined);
      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("blur-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/form",
          steps: [
          { type: "blur", selector: "#email" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes clear step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("clear-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/form",
          steps: [
          { type: "clear", selector: "#search" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.click).toHaveBeenCalledWith("#search", { clickCount: 3 });
      expect(mockPage.keyboard.press).toHaveBeenCalledWith("Backspace");
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes keypress step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("keypress-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/form",
          steps: [
          { type: "keypress", key: "Tab" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.keyboard.press).toHaveBeenCalledWith("Tab");
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes keypress step with modifiers", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("keypress-modifiers-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/form",
          steps: [
          { type: "keypress", key: "a", modifiers: ["Control"] },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.keyboard.down).toHaveBeenCalledWith("Control");
      expect(mockPage.keyboard.press).toHaveBeenCalledWith("a");
      expect(mockPage.keyboard.up).toHaveBeenCalledWith("Control");
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes evaluate step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      // Queue evaluate results: custom script, then metrics
      queueEvaluateResult("Script Result");
      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("evaluate-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/page",
          steps: [
          { type: "evaluate", script: "return document.title;" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes radio step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("radio-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/form",
          steps: [
          { type: "radio", selector: "input[type='radio']", value: "option1" },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.waitForSelector).toHaveBeenCalledWith("input[type='radio'][value=\"option1\"]", { timeout: 5000 });
      expect(mockPage.click).toHaveBeenCalledWith("input[type='radio'][value=\"option1\"]");
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes upload step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("upload-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/upload",
          steps: [
          { type: "upload", selector: "input[type='file']", filePaths: ["/path/to/file.pdf"] },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.$).toHaveBeenCalledWith("input[type='file']");
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("executes submit step", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      // Queue evaluate results: form submit, then metrics
      queueEvaluateResult(undefined);
      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 1000,
        scrollX: 0,
        scrollY: 0,
      });

      const imageBuffer = Buffer.from("submit-image");
      setScreenshotBuffer(imageBuffer);

      const response = await handler({
        url: "https://example.com/form",
          steps: [
          { type: "submit", selector: "#contact-form", waitForNavigation: false },
          { type: "screenshot" },
        ],
      });

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("handles scroll with smooth behavior", async () => {
      const logger = createLogger();
      const handler = getToolHandler(registerCaptureScreenshotTool, logger);

      // Queue evaluate results: scroll, then metrics
      queueEvaluateResult(undefined);
      queueEvaluateResult({
        viewportWidth: 1280,
        viewportHeight: 720,
        scrollWidth: 1280,
        scrollHeight: 2000,
        scrollX: 0,
        scrollY: 500,
      });

      const imageBuffer = Buffer.from("smooth-scroll-image");
      setScreenshotBuffer(imageBuffer);

      const startTime = Date.now();
      const response = await handler({
        url: "https://example.com/long-page",
          steps: [
          { type: "scroll", y: 500, behavior: "smooth" },
          { type: "screenshot" },
        ],
      });
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(400); // smooth scroll waits 500ms
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(response.content[0].text).toContain("Steps executed: 2");
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });
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
          url: "https://example.org/", // URL normalizer adds trailing slash
        },
      });
      return true;
    });
  });
});
