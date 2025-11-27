import puppeteer from "puppeteer";
import { z } from "zod";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { Logger } from "../logger.js";
import type { CaptureScreenshotInput, CaptureScreenshotResult, ScreenshotMetadata } from "../types/screenshot.js";
import { normalizeHeadersInput, toPuppeteerCookies } from "../utils/requestOptions.js";
import { normalizeUrl } from "../utils/url.js";

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
      const { url, fullPage } = input;
      logger.info("captureScreenshot:requested", { url, fullPage });

      try {
        const result = await runScreenshot(input, logger);

        logger.info("captureScreenshot:completed", {
          url,
          bytes: result.metadata.bytes,
          viewport: `${result.metadata.viewportWidth}x${result.metadata.viewportHeight}`,
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

        throw new McpError(ErrorCode.InvalidParams, "captureScreenshot failed", {
          url,
          detail: (error as Error).message,
        });
      }
    },
  );
}

async function runScreenshot(args: CaptureScreenshotInput, logger: Logger): Promise<CaptureScreenshotResult> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(DEFAULT_VIEWPORT);
    page.setDefaultNavigationTimeout(CAPTURE_TIMEOUT_MS);

    const normalizedHeaders = normalizeHeadersInput(args.headers);
    if (normalizedHeaders) {
      await page.setExtraHTTPHeaders(normalizedHeaders);
    }

    const cookieParams = toPuppeteerCookies(args.cookies, args.url);
    if (cookieParams.length > 0) {
      await page.setCookie(...cookieParams);
    }

    const response = await page.goto(args.url, {
      waitUntil: "networkidle0",
      timeout: CAPTURE_TIMEOUT_MS,
    });

    if (!response || !response.ok()) {
      throw new Error(`Navigation failed with status: ${response?.status() ?? "unknown"}`);
    }

    const screenshotBuffer = (await page.screenshot({
      type: "png",
      fullPage: Boolean(args.fullPage),
    })) as Buffer;

    const metrics = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }));

    const metadata: ScreenshotMetadata = {
      url: args.url,
      fullPage: Boolean(args.fullPage),
      viewportWidth: metrics.viewportWidth,
      viewportHeight: metrics.viewportHeight,
      scrollWidth: metrics.scrollWidth,
      scrollHeight: metrics.scrollHeight,
      bytes: screenshotBuffer.length,
      capturedAt: new Date().toISOString(),
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
    await browser.close();
  }
}

function formatMetadata(metadata: ScreenshotMetadata): string {
  return [
    "mcp-page-capture screenshot",
    `URL: ${metadata.url}`,
    `Captured: ${metadata.capturedAt}`,
    `Full page: ${metadata.fullPage}`,
    `Viewport: ${metadata.viewportWidth}x${metadata.viewportHeight}`,
    `Document: ${metadata.scrollWidth}x${metadata.scrollHeight}`,
    `Size: ${(metadata.bytes / 1024).toFixed(1)} KB`,
  ].join("\n");
}
