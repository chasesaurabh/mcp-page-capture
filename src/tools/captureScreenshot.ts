import puppeteer from "puppeteer";
import { z } from "zod";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { Logger } from "../logger.js";
import type { CaptureScreenshotInput, CaptureScreenshotResult, ScreenshotMetadata, ViewportConfig, RetryConfig, ScrollConfig, ClickAction, ActionStep } from "../types/screenshot.js";
import { normalizeHeadersInput, toPuppeteerCookies } from "../utils/requestOptions.js";
import { normalizeUrl } from "../utils/url.js";
import { withRetry, type RetryPolicy } from "../utils/retry.js";
import { getViewportPreset, mergeViewportOptions, type ViewportPreset } from "../config/viewports.js";
import { getGlobalTelemetry } from "../telemetry/index.js";
import { getStorageTarget, getDefaultStorageTarget } from "../storage/index.js";

const CAPTURE_TIMEOUT_MS = 45_000;
const DEFAULT_VIEWPORT = { width: 1280, height: 720 } as const;

const headersSchema = z
  .record(z.string().min(1, "Header names cannot be empty."), z.string().min(1, "Header values cannot be empty."))
  .optional()
  .describe("Custom HTTP headers to send with the request.");

const cookieSchema = z.object({
  name: z.string({ required_error: "Cookie name is required." }).min(1, "Cookie name cannot be empty.").describe("The name of the cookie."),
  value: z.string({ required_error: "Cookie value is required." }).describe("The value of the cookie."),
  url: z
    .string()
    .optional()
    .describe("The URL to associate with the cookie. If omitted, the target URL is used.")
    .transform((value, ctx) => {
      if (!value) return value;
      try {
        return normalizeUrl(value);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid cookie URL.",
        });
        return z.NEVER;
      }
    }),
  domain: z.string().optional().describe("The domain the cookie applies to."),
  path: z.string().optional().describe("The path the cookie applies to."),
  secure: z.boolean().optional().describe("Whether the cookie is secure (HTTPS only)."),
  httpOnly: z.boolean().optional().describe("Whether the cookie is HTTP-only (not accessible via JavaScript)."),
  sameSite: z.enum(["Strict", "Lax", "None"]).optional().describe("The SameSite attribute of the cookie."),
  expires: z.number().optional().describe("Unix timestamp (in seconds) when the cookie expires."),
}).describe("A cookie to set before loading the page.");

const viewportSchema = z.object({
  preset: z.string().optional().describe("Device preset name (e.g., 'iphone-14', 'desktop-hd', 'ipad-pro')."),
  width: z.number().positive().optional().describe("Viewport width in pixels. Overrides preset width if specified."),
  height: z.number().positive().optional().describe("Viewport height in pixels. Overrides preset height if specified."),
  deviceScaleFactor: z.number().positive().optional().describe("Device scale factor (DPR). Defaults to 1."),
  isMobile: z.boolean().optional().describe("Whether to emulate a mobile device."),
  hasTouch: z.boolean().optional().describe("Whether the device supports touch events."),
  isLandscape: z.boolean().optional().describe("Whether the viewport is in landscape orientation."),
  userAgent: z.string().optional().describe("Custom User-Agent string to use."),
}).optional().describe("Viewport configuration or device preset for rendering.");

const retryPolicySchema = z.object({
  maxRetries: z.number().min(0).max(10).optional().describe("Maximum number of retry attempts (0-10). Defaults to 3."),
  initialDelayMs: z.number().positive().optional().describe("Initial delay in milliseconds before the first retry."),
  maxDelayMs: z.number().positive().optional().describe("Maximum delay in milliseconds between retries."),
  backoffMultiplier: z.number().min(1).optional().describe("Multiplier for exponential backoff (e.g., 2 doubles delay each retry)."),
  retryableStatusCodes: z.array(z.number()).optional().describe("HTTP status codes that should trigger a retry (e.g., [429, 503])."),
  retryableErrors: z.array(z.string()).optional().describe("Error message patterns that should trigger a retry."),
}).optional().describe("Retry policy configuration for handling transient failures.");

const scrollSchema = z.object({
  x: z.number().min(0).optional().describe("Horizontal scroll position in pixels."),
  y: z.number().min(0).optional().describe("Vertical scroll position in pixels."),
  selector: z.string().min(1).optional().describe("CSS selector of an element to scroll into view. Takes precedence over x/y coordinates."),
  behavior: z.enum(["auto", "smooth"]).optional().describe("Scroll behavior: 'auto' for instant, 'smooth' for animated scrolling."),
}).optional().describe("Scroll position configuration before capturing the screenshot.");

const clickActionSchema = z.object({
  selector: z.string().min(1, "Click selector cannot be empty.").describe("CSS selector of the element to click."),
  delayBefore: z.number().min(0).max(30000).optional().describe("Delay in milliseconds before clicking (max 30000)."),
  delayAfter: z.number().min(0).max(30000).optional().describe("Delay in milliseconds after clicking (max 30000)."),
  waitForSelector: z.string().min(1).optional().describe("CSS selector to wait for after clicking (e.g., modal content)."),
  waitForNavigation: z.boolean().optional().describe("Whether to wait for page navigation after clicking."),
  button: z.enum(["left", "right", "middle"]).optional().describe("Mouse button to use for the click."),
  clickCount: z.number().min(1).max(3).optional().describe("Number of clicks (1 for single, 2 for double, 3 for triple)."),
}).describe("A click action to perform before capturing the screenshot.");

const clickActionsSchema = z.array(clickActionSchema).optional().describe("Array of click actions to execute in order before capturing.");

const delayStepSchema = z.object({
  type: z.literal("delay").describe("Step type identifier."),
  duration: z.number().min(0).max(30000, "Delay duration cannot exceed 30 seconds.").describe("Duration to wait in milliseconds (max 30000)."),
}).describe("A delay step that pauses execution for a specified duration.");

const clickStepSchema = z.object({
  type: z.literal("click").describe("Step type identifier."),
  selector: z.string().min(1, "Click selector cannot be empty.").describe("CSS selector of the element to click."),
  button: z.enum(["left", "right", "middle"]).optional().describe("Mouse button to use for the click."),
  clickCount: z.number().min(1).max(3).optional().describe("Number of clicks (1 for single, 2 for double, 3 for triple)."),
  waitForSelector: z.string().min(1).optional().describe("CSS selector to wait for after clicking."),
  waitForNavigation: z.boolean().optional().describe("Whether to wait for page navigation after clicking."),
}).describe("A click step that clicks an element on the page.");

const scrollStepSchema = z.object({
  type: z.literal("scroll").describe("Step type identifier."),
  x: z.number().min(0).optional().describe("Horizontal scroll position in pixels."),
  y: z.number().min(0).optional().describe("Vertical scroll position in pixels."),
  selector: z.string().min(1).optional().describe("CSS selector of an element to scroll into view."),
  behavior: z.enum(["auto", "smooth"]).optional().describe("Scroll behavior: 'auto' for instant, 'smooth' for animated."),
}).describe("A scroll step that scrolls the page to a position or element.");

const waitForSelectorStepSchema = z.object({
  type: z.literal("waitForSelector").describe("Step type identifier."),
  selector: z.string().min(1, "Selector cannot be empty.").describe("CSS selector to wait for."),
  timeout: z.number().min(0).max(60000).optional().describe("Maximum time to wait in milliseconds (max 60000). Defaults to 10000."),
}).describe("A step that waits for an element matching the selector to appear.");

const screenshotStepSchema = z.object({
  type: z.literal("screenshot").describe("Step type identifier."),
}).describe("A step that captures a screenshot at the current page state.");

const actionStepSchema = z.discriminatedUnion("type", [
  delayStepSchema,
  clickStepSchema,
  scrollStepSchema,
  waitForSelectorStepSchema,
  screenshotStepSchema,
]);

const stepsSchema = z.array(actionStepSchema).optional().describe("Ordered sequence of action steps to execute. Supports delay, click, scroll, waitForSelector, and screenshot steps.");

const captureScreenshotSchema = z.object({
  url: z
    .string({ required_error: "URL is required." })
    .min(1, "URL cannot be empty.")
    .describe("The URL of the webpage to capture.")
    .transform((value: string, ctx: z.RefinementCtx) => {
      try {
        return normalizeUrl(value);
      } catch (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: (error as Error).message,
        });
        return z.NEVER;
      }
    }),
  fullPage: z.boolean().optional().default(false).describe("Whether to capture the entire scrollable page. Defaults to false (viewport only)."),
  headers: headersSchema,
  cookies: z.array(cookieSchema).optional().describe("Cookies to set before loading the page."),
  viewport: viewportSchema,
  retryPolicy: retryPolicySchema,
  storageTarget: z.string().optional().describe("Storage target identifier for persisting the screenshot."),
  scroll: scrollSchema,
  clickActions: clickActionsSchema,
  steps: stepsSchema,
});

export function registerCaptureScreenshotTool(server: McpServer, logger: Logger) {
  server.registerTool(
    "captureScreenshot",
    {
      title: "Capture a screenshot",
      description: "Capture a PNG screenshot for the provided URL (full page optional). Supports click actions to interact with the page before capture (e.g., open modals, navigate carousels, expand dropdowns).",
      inputSchema: captureScreenshotSchema,
    },
    async (input) => {
      const { url, fullPage, viewport, retryPolicy, storageTarget, scroll } = input;
      const telemetry = getGlobalTelemetry(logger);
      
      logger.info("captureScreenshot:requested", { 
        url, 
        fullPage,
        viewportPreset: viewport?.preset,
        storageTarget,
        scroll: scroll ? { x: scroll.x, y: scroll.y, selector: scroll.selector } : undefined,
      });

      await telemetry.emitTelemetry("tool.invoked", {
        tool: "captureScreenshot",
        url,
        fullPage,
        viewportPreset: viewport?.preset,
      });

      try {
        const result = await runScreenshot(input, logger);

        logger.info("captureScreenshot:completed", {
          url,
          bytes: result.metadata.bytes,
          viewport: `${result.metadata.viewportWidth}x${result.metadata.viewportHeight}`,
          retryAttempts: result.metadata.retryAttempts,
          storageLocation: result.metadata.storageLocation,
        });

        await telemetry.emitTelemetry("tool.completed", {
          tool: "captureScreenshot",
          url,
          bytes: result.metadata.bytes,
          retryAttempts: result.metadata.retryAttempts,
        });

        const metadataSummary = formatMetadata(result.metadata);

        return {
          content: [
            {
              type: "text",
              text: metadataSummary,
            },
            {
              type: "image",
              mimeType: result.mimeType,
              data: result.imageBase64,
            },
          ],
        };
      } catch (error) {
        logger.error("captureScreenshot:failed", {
          url,
          reason: (error as Error).message,
        });

        await telemetry.emitTelemetry("tool.failed", {
          tool: "captureScreenshot",
          url,
          error: (error as Error).message,
        });

        throw new McpError(ErrorCode.InvalidParams, "captureScreenshot failed", {
          url,
          detail: (error as Error).message,
        });
      }
    },
  );
}

async function runScreenshot(args: CaptureScreenshotInput, logger: Logger): Promise<CaptureScreenshotResult> {
  const telemetry = getGlobalTelemetry(logger);
  let retryAttempts = 0;
  
  // Prepare viewport configuration
  const viewport = resolveViewport(args.viewport, logger);
  
  // Prepare retry policy
  const retryPolicy: Partial<RetryPolicy> = args.retryPolicy || {};
  
  const executeCapture = async (): Promise<CaptureScreenshotResult> => {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      await telemetry.emitTelemetry("browser.launched", { tool: "captureScreenshot" });
      
      const page = await browser.newPage();
      
      // Apply viewport configuration
      await page.setViewport(viewport);
      
      // Set user agent if specified
      if (viewport.userAgent) {
        await page.setUserAgent(viewport.userAgent);
      }
      
      // Enable touch if specified
      if (viewport.hasTouch) {
        await page.evaluateOnNewDocument(() => {
          (window as any).ontouchstart = true;
        });
      }
      
      page.setDefaultNavigationTimeout(CAPTURE_TIMEOUT_MS);

      const normalizedHeaders = normalizeHeadersInput(args.headers);
      if (normalizedHeaders) {
        await page.setExtraHTTPHeaders(normalizedHeaders);
      }

      const cookieParams = toPuppeteerCookies(args.cookies, args.url);
      if (cookieParams.length > 0) {
        await page.setCookie(...cookieParams);
      }

      await telemetry.emitTelemetry("navigation.started", { 
        url: args.url,
        viewport: `${viewport.width}x${viewport.height}`,
      });

      const response = await page.goto(args.url, {
        waitUntil: "networkidle0",
        timeout: CAPTURE_TIMEOUT_MS,
      });

      if (!response || !response.ok()) {
        const status = response?.status() ?? "unknown";
        await telemetry.emitTelemetry("navigation.failed", { 
          url: args.url, 
          status,
        });
        throw new Error(`Navigation failed with status: ${status}`);
      }

      await telemetry.emitTelemetry("navigation.completed", { 
        url: args.url,
        status: response.status(),
      });

      let screenshotBuffer: Buffer;
      let clickActionsExecuted = 0;
      let stepsExecuted = 0;

      // If steps are provided, use the new steps-based flow
      if (args.steps && args.steps.length > 0) {
        const stepsResult = await executeSteps(page, args.steps, Boolean(args.fullPage), logger);
        screenshotBuffer = stepsResult.screenshotBuffer;
        stepsExecuted = stepsResult.stepsExecuted;
        
        logger.info("steps:executed", {
          url: args.url,
          stepsRequested: args.steps.length,
          stepsExecuted,
          screenshotsTaken: stepsResult.screenshotsTaken,
        });

        await telemetry.emitTelemetry("screenshot.captured", {
          url: args.url,
          bytes: screenshotBuffer.length,
          fullPage: args.fullPage,
        });
      } else {
        // Legacy flow: clickActions, scroll, then screenshot
        if (args.clickActions && args.clickActions.length > 0) {
          clickActionsExecuted = await executeClickActions(page, args.clickActions, logger);
          logger.info("clickActions:executed", {
            url: args.url,
            actionsRequested: args.clickActions.length,
            actionsExecuted: clickActionsExecuted,
          });
        }

        // Execute scroll if specified
        if (args.scroll) {
          const scrollPosition = await executeScroll(page, args.scroll, logger);
          await telemetry.emitTelemetry("scroll.executed", {
            url: args.url,
            scrollX: scrollPosition.x,
            scrollY: scrollPosition.y,
            selector: args.scroll.selector,
          });
        }

        screenshotBuffer = (await page.screenshot({
          type: "png",
          fullPage: Boolean(args.fullPage),
        })) as Buffer;

        await telemetry.emitTelemetry("screenshot.captured", {
          url: args.url,
          bytes: screenshotBuffer.length,
          fullPage: args.fullPage,
        });
      }

      const metrics = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      }));

      // Store screenshot if storage target is specified
      let storageLocation: string | undefined;
      if (args.storageTarget) {
        const storage = getStorageTarget(args.storageTarget) || getDefaultStorageTarget(logger);
        const storageResult = await storage.save(screenshotBuffer, {
          mimeType: "image/png",
          timestamp: new Date().toISOString(),
          tags: {
            url: args.url,
            fullPage: String(args.fullPage),
            viewport: `${viewport.width}x${viewport.height}`,
          },
        });
        storageLocation = storageResult.location;
      }

      const metadata: ScreenshotMetadata = {
        url: args.url,
        fullPage: Boolean(args.fullPage),
        viewportWidth: metrics.viewportWidth,
        viewportHeight: metrics.viewportHeight,
        scrollWidth: metrics.scrollWidth,
        scrollHeight: metrics.scrollHeight,
        scrollX: metrics.scrollX,
        scrollY: metrics.scrollY,
        bytes: screenshotBuffer.length,
        capturedAt: new Date().toISOString(),
        viewportPreset: args.viewport?.preset,
        retryAttempts,
        storageLocation,
        clickActionsExecuted: clickActionsExecuted > 0 ? clickActionsExecuted : undefined,
        stepsExecuted: stepsExecuted > 0 ? stepsExecuted : undefined,
      };

      const imageBase64 = screenshotBuffer.toString("base64");

      return {
        metadata,
        imageBase64,
        mimeType: "image/png",
      };
    } catch (error) {
      logger.error("captureScreenshot:puppeteerError", { error: (error as Error).message });
      throw error;
    } finally {
      await telemetry.emitTelemetry("browser.closed", { tool: "captureScreenshot" });
      await browser.close();
    }
  };
  
  // Wrap with retry logic
  return withRetry(executeCapture, {
    policy: retryPolicy,
    logger,
    context: "captureScreenshot",
  }).then(result => {
    // Track retry attempts
    retryAttempts = result.metadata.retryAttempts || 0;
    return result;
  });
}

function resolveViewport(config?: ViewportConfig, logger?: Logger): ViewportPreset {
  let viewport: ViewportPreset = DEFAULT_VIEWPORT as ViewportPreset;
  
  if (config?.preset) {
    const preset = getViewportPreset(config.preset);
    if (preset) {
      viewport = preset;
      logger?.debug("viewport:using_preset", { preset: config.preset });
    } else {
      logger?.warn("viewport:preset_not_found", { preset: config.preset });
    }
  }
  
  // Apply custom overrides
  if (config) {
    viewport = mergeViewportOptions(viewport, {
      width: config.width,
      height: config.height,
      deviceScaleFactor: config.deviceScaleFactor,
      isMobile: config.isMobile,
      hasTouch: config.hasTouch,
      isLandscape: config.isLandscape,
      userAgent: config.userAgent,
    });
  }
  
  return viewport;
}

async function executeScroll(
  page: Awaited<ReturnType<typeof puppeteer.launch>>['newPage'] extends () => Promise<infer P> ? P : never,
  scroll: ScrollConfig,
  logger?: Logger
): Promise<{ x: number; y: number }> {
  const behavior = scroll.behavior || "auto";
  
  if (scroll.selector) {
    // Scroll element into view
    logger?.debug("scroll:to_selector", { selector: scroll.selector, behavior });
    
    const scrollResult = await page.evaluate(
      (params: { selector: string; behavior: ScrollBehavior }) => {
        const element = document.querySelector(params.selector);
        if (!element) {
          return { ok: false, error: `Element not found: ${params.selector}` };
        }
        element.scrollIntoView({ behavior: params.behavior, block: "start" });
        return {
          ok: true,
          x: window.scrollX,
          y: window.scrollY,
        };
      },
      { selector: scroll.selector, behavior }
    );
    
    if (!scrollResult.ok) {
      logger?.warn("scroll:selector_not_found", { selector: scroll.selector });
      return { x: 0, y: 0 };
    }
    
    // Wait for smooth scroll to complete
    if (behavior === "smooth") {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return { x: scrollResult.x ?? 0, y: scrollResult.y ?? 0 };
  }
  
  // Scroll to specific coordinates
  const x = scroll.x ?? 0;
  const y = scroll.y ?? 0;
  
  logger?.debug("scroll:to_position", { x, y, behavior });
  
  await page.evaluate(
    (params: { x: number; y: number; behavior: ScrollBehavior }) => {
      window.scrollTo({ left: params.x, top: params.y, behavior: params.behavior });
    },
    { x, y, behavior }
  );
  
  // Wait for smooth scroll to complete
  if (behavior === "smooth") {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Return actual scroll position
  const position = await page.evaluate(() => ({
    x: window.scrollX,
    y: window.scrollY,
  }));
  
  return position;
}

async function executeClickActions(
  page: Awaited<ReturnType<typeof puppeteer.launch>>['newPage'] extends () => Promise<infer P> ? P : never,
  clickActions: ClickAction[],
  logger?: Logger
): Promise<number> {
  let executedCount = 0;
  
  for (let i = 0; i < clickActions.length; i++) {
    const action = clickActions[i];
    logger?.debug("clickAction:executing", { 
      index: i, 
      selector: action.selector,
      button: action.button || "left",
      clickCount: action.clickCount || 1,
    });
    
    try {
      // Apply delay before click (for animations, page settling, etc.)
      if (action.delayBefore && action.delayBefore > 0) {
        logger?.debug("clickAction:delayingBefore", { 
          index: i, 
          delayBefore: action.delayBefore,
        });
        await new Promise(resolve => setTimeout(resolve, action.delayBefore));
      }
      
      // Wait for the element to be present
      await page.waitForSelector(action.selector, { timeout: 10000 });
      
      // Click the element
      const clickOptions: { button?: "left" | "right" | "middle"; clickCount?: number } = {};
      if (action.button) {
        clickOptions.button = action.button;
      }
      if (action.clickCount) {
        clickOptions.clickCount = action.clickCount;
      }
      
      if (action.waitForNavigation) {
        // Click and wait for navigation simultaneously
        await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 }),
          page.click(action.selector, clickOptions),
        ]);
      } else {
        await page.click(action.selector, clickOptions);
      }
      
      executedCount++;
      logger?.debug("clickAction:clicked", { index: i, selector: action.selector });
      
      // Wait for a specific selector to appear after click (e.g., modal content)
      if (action.waitForSelector) {
        logger?.debug("clickAction:waitingForSelector", { 
          index: i, 
          waitForSelector: action.waitForSelector,
        });
        await page.waitForSelector(action.waitForSelector, { timeout: 10000 });
        logger?.debug("clickAction:selectorFound", { 
          index: i, 
          waitForSelector: action.waitForSelector,
        });
      }
      
      // Apply delay after click (for animations, content loading, etc.)
      if (action.delayAfter && action.delayAfter > 0) {
        logger?.debug("clickAction:delaying", { 
          index: i, 
          delayAfter: action.delayAfter,
        });
        await new Promise(resolve => setTimeout(resolve, action.delayAfter));
      }
      
    } catch (error) {
      logger?.warn("clickAction:failed", { 
        index: i, 
        selector: action.selector, 
        error: (error as Error).message,
      });
      // Continue with remaining actions even if one fails
    }
  }
  
  return executedCount;
}

interface StepsExecutionResult {
  screenshotBuffer: Buffer;
  stepsExecuted: number;
  screenshotsTaken: number;
}

async function executeSteps(
  page: Awaited<ReturnType<typeof puppeteer.launch>>['newPage'] extends () => Promise<infer P> ? P : never,
  steps: ActionStep[],
  fullPage: boolean,
  logger?: Logger
): Promise<StepsExecutionResult> {
  let stepsExecuted = 0;
  let screenshotsTaken = 0;
  let screenshotBuffer: Buffer | null = null;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    logger?.debug("step:executing", { index: i, type: step.type });

    try {
      switch (step.type) {
        case "delay": {
          logger?.debug("step:delay", { index: i, duration: step.duration });
          await new Promise(resolve => setTimeout(resolve, step.duration));
          stepsExecuted++;
          break;
        }

        case "click": {
          logger?.debug("step:click", { 
            index: i, 
            selector: step.selector,
            button: step.button || "left",
            clickCount: step.clickCount || 1,
          });

          // Wait for the element to be present
          await page.waitForSelector(step.selector, { timeout: 10000 });

          // Click the element
          const clickOptions: { button?: "left" | "right" | "middle"; clickCount?: number } = {};
          if (step.button) {
            clickOptions.button = step.button;
          }
          if (step.clickCount) {
            clickOptions.clickCount = step.clickCount;
          }

          if (step.waitForNavigation) {
            // Click and wait for navigation simultaneously
            await Promise.all([
              page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 }),
              page.click(step.selector, clickOptions),
            ]);
          } else {
            await page.click(step.selector, clickOptions);
          }

          logger?.debug("step:clicked", { index: i, selector: step.selector });

          // Wait for a specific selector to appear after click
          if (step.waitForSelector) {
            logger?.debug("step:waitingForSelector", { 
              index: i, 
              waitForSelector: step.waitForSelector,
            });
            await page.waitForSelector(step.waitForSelector, { timeout: 10000 });
          }

          stepsExecuted++;
          break;
        }

        case "scroll": {
          const behavior = step.behavior || "auto";

          if (step.selector) {
            logger?.debug("step:scroll:to_selector", { index: i, selector: step.selector, behavior });

            const scrollResult = await page.evaluate(
              (params: { selector: string; behavior: ScrollBehavior }) => {
                const element = document.querySelector(params.selector);
                if (!element) {
                  return { ok: false, error: `Element not found: ${params.selector}` };
                }
                element.scrollIntoView({ behavior: params.behavior, block: "start" });
                return { ok: true, x: window.scrollX, y: window.scrollY };
              },
              { selector: step.selector, behavior }
            );

            if (!scrollResult.ok) {
              logger?.warn("step:scroll:selector_not_found", { index: i, selector: step.selector });
            }
          } else {
            const x = step.x ?? 0;
            const y = step.y ?? 0;
            logger?.debug("step:scroll:to_position", { index: i, x, y, behavior });

            await page.evaluate(
              (params: { x: number; y: number; behavior: ScrollBehavior }) => {
                window.scrollTo({ left: params.x, top: params.y, behavior: params.behavior });
              },
              { x, y, behavior }
            );
          }

          // Wait for smooth scroll to complete
          if (behavior === "smooth") {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          stepsExecuted++;
          break;
        }

        case "waitForSelector": {
          const timeout = step.timeout ?? 10000;
          logger?.debug("step:waitForSelector", { index: i, selector: step.selector, timeout });
          await page.waitForSelector(step.selector, { timeout });
          stepsExecuted++;
          break;
        }

        case "screenshot": {
          logger?.debug("step:screenshot", { index: i, fullPage });
          screenshotBuffer = (await page.screenshot({
            type: "png",
            fullPage,
          })) as Buffer;
          screenshotsTaken++;
          stepsExecuted++;
          break;
        }
      }
    } catch (error) {
      logger?.warn("step:failed", {
        index: i,
        type: step.type,
        error: (error as Error).message,
      });
      // Continue with remaining steps even if one fails
    }
  }

  // If no screenshot step was executed, take one at the end
  if (!screenshotBuffer) {
    logger?.debug("step:auto_screenshot", { reason: "no screenshot step found" });
    screenshotBuffer = (await page.screenshot({
      type: "png",
      fullPage,
    })) as Buffer;
    screenshotsTaken++;
  }

  return {
    screenshotBuffer,
    stepsExecuted,
    screenshotsTaken,
  };
}

function formatMetadata(metadata: ScreenshotMetadata): string {
  const lines = [
    "mcp-page-capture screenshot",
    `URL: ${metadata.url}`,
    `Captured: ${metadata.capturedAt}`,
    `Full page: ${metadata.fullPage}`,
    `Viewport: ${metadata.viewportWidth}x${metadata.viewportHeight}`,
    `Document: ${metadata.scrollWidth}x${metadata.scrollHeight}`,
    `Scroll position: (${metadata.scrollX}, ${metadata.scrollY})`,
    `Size: ${(metadata.bytes / 1024).toFixed(1)} KB`,
  ];
  
  if (metadata.viewportPreset) {
    lines.push(`Viewport preset: ${metadata.viewportPreset}`);
  }
  
  if (metadata.retryAttempts && metadata.retryAttempts > 0) {
    lines.push(`Retry attempts: ${metadata.retryAttempts}`);
  }
  
  if (metadata.storageLocation) {
    lines.push(`Stored at: ${metadata.storageLocation}`);
  }
  
  if (metadata.clickActionsExecuted && metadata.clickActionsExecuted > 0) {
    lines.push(`Click actions executed: ${metadata.clickActionsExecuted}`);
  }
  
  if (metadata.stepsExecuted && metadata.stepsExecuted > 0) {
    lines.push(`Steps executed: ${metadata.stepsExecuted}`);
  }
  
  return lines.join("\n");
}
