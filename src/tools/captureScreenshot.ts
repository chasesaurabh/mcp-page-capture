import puppeteer from "puppeteer";
import { z } from "zod";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { Logger } from "../logger.js";
import type { CaptureScreenshotInput, CaptureScreenshotResult, ScreenshotMetadata, ViewportConfig, RetryConfig, ScrollConfig } from "../types/screenshot.js";
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
  .optional();

const cookieSchema = z.object({
  name: z.string({ required_error: "Cookie name is required." }).min(1, "Cookie name cannot be empty."),
  value: z.string({ required_error: "Cookie value is required." }),
  url: z
    .string()
    .optional()
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
  domain: z.string().optional(),
  path: z.string().optional(),
  secure: z.boolean().optional(),
  httpOnly: z.boolean().optional(),
  sameSite: z.enum(["Strict", "Lax", "None"]).optional(),
  expires: z.number().optional(),
});

const viewportSchema = z.object({
  preset: z.string().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  deviceScaleFactor: z.number().positive().optional(),
  isMobile: z.boolean().optional(),
  hasTouch: z.boolean().optional(),
  isLandscape: z.boolean().optional(),
  userAgent: z.string().optional(),
}).optional();

const retryPolicySchema = z.object({
  maxRetries: z.number().min(0).max(10).optional(),
  initialDelayMs: z.number().positive().optional(),
  maxDelayMs: z.number().positive().optional(),
  backoffMultiplier: z.number().min(1).optional(),
  retryableStatusCodes: z.array(z.number()).optional(),
  retryableErrors: z.array(z.string()).optional(),
}).optional();

const scrollSchema = z.object({
  x: z.number().min(0).optional(),
  y: z.number().min(0).optional(),
  selector: z.string().min(1).optional(),
  behavior: z.enum(["auto", "smooth"]).optional(),
}).optional();

const captureScreenshotSchema = z.object({
  url: z
    .string({ required_error: "URL is required." })
    .min(1, "URL cannot be empty.")
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
  fullPage: z.boolean().optional().default(false),
  headers: headersSchema,
  cookies: z.array(cookieSchema).optional(),
  viewport: viewportSchema,
  retryPolicy: retryPolicySchema,
  storageTarget: z.string().optional(),
  scroll: scrollSchema,
});

export function registerCaptureScreenshotTool(server: McpServer, logger: Logger) {
  server.registerTool(
    "captureScreenshot",
    {
      title: "Capture a screenshot",
      description: "Capture a PNG screenshot for the provided URL (full page optional).",
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

      // Execute scroll if specified
      let scrollPosition = { x: 0, y: 0 };
      if (args.scroll) {
        scrollPosition = await executeScroll(page, args.scroll, logger);
        await telemetry.emitTelemetry("scroll.executed", {
          url: args.url,
          scrollX: scrollPosition.x,
          scrollY: scrollPosition.y,
          selector: args.scroll.selector,
        });
      }

      const screenshotBuffer = (await page.screenshot({
        type: "png",
        fullPage: Boolean(args.fullPage),
      })) as Buffer;

      await telemetry.emitTelemetry("screenshot.captured", {
        url: args.url,
        bytes: screenshotBuffer.length,
        fullPage: args.fullPage,
      });

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
  
  return lines.join("\n");
}
