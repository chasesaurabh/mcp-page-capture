import puppeteer from "puppeteer";
import { z } from "zod";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { Logger } from "../logger.js";
import type { ExtractDomInput, ExtractDomResult } from "../types/dom.js";
import type { ViewportConfig, RetryConfig } from "../types/screenshot.js";
import { normalizeHeadersInput, toPuppeteerCookies } from "../utils/requestOptions.js";
import { normalizeUrl } from "../utils/url.js";
import { withRetry, type RetryPolicy } from "../utils/retry.js";
import { getViewportPreset, mergeViewportOptions, type ViewportPreset } from "../config/viewports.js";
import { getGlobalTelemetry } from "../telemetry/index.js";
import { getStorageTarget, getDefaultStorageTarget } from "../storage/index.js";

const EXTRACTION_TIMEOUT_MS = 45_000;
const DEFAULT_VIEWPORT = { width: 1280, height: 720 } as const;
const MAX_DOM_NODES = 5_000;
const MAX_HTML_CHARS = 200_000;
const MAX_TEXT_CHARS = 100_000;

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

const extractDomSchema = z.object({
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
  selector: z.string().min(1, "Selector cannot be empty.").optional(),
  headers: headersSchema,
  cookies: z.array(cookieSchema).optional(),
  viewport: viewportSchema,
  retryPolicy: retryPolicySchema,
  storageTarget: z.string().optional(),
});

export function registerExtractDomTool(server: McpServer, logger: Logger) {
  server.registerTool(
    "extractDom",
    {
      title: "Extract DOM",
      description: "Fetch HTML, readable text, and a structured DOM tree for a URL with an optional selector filter.",
      inputSchema: extractDomSchema,
    },
    async (input) => {
      const { url, selector, viewport, retryPolicy, storageTarget } = input;
      const telemetry = getGlobalTelemetry(logger);
      
      logger.info("extractDom:requested", { 
        url,
        selector: selector ?? null,
        viewportPreset: viewport?.preset,
        storageTarget,
      });

      await telemetry.emitTelemetry("tool.invoked", {
        tool: "extractDom",
        url,
        selector,
        viewportPreset: viewport?.preset,
      });

      try {
        const result = await runDomExtraction(input, logger);

        await telemetry.emitTelemetry("tool.completed", {
          tool: "extractDom",
          url,
          nodeCount: result.nodeCount,
          retryAttempts: result.retryAttempts,
        });

        return {
          content: buildDomContent(result),
        };
      } catch (error) {
        logger.error("extractDom:failed", {
          url,
          selector: selector ?? null,
          reason: (error as Error).message,
        });

        await telemetry.emitTelemetry("tool.failed", {
          tool: "extractDom",
          url,
          error: (error as Error).message,
        });

        throw new McpError(ErrorCode.InvalidParams, "extractDom failed", {
          url,
          detail: (error as Error).message,
        });
      }
    },
  );
}

export async function runDomExtraction(args: ExtractDomInput, logger: Logger): Promise<ExtractDomResult> {
  const telemetry = getGlobalTelemetry(logger);
  let retryAttempts = 0;
  
  // Prepare viewport configuration
  const viewport = resolveViewport(args.viewport, logger);
  
  // Prepare retry policy
  const retryPolicy: Partial<RetryPolicy> = args.retryPolicy || {};
  
  const executeExtraction = async (): Promise<ExtractDomResult> => {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      await telemetry.emitTelemetry("browser.launched", { tool: "extractDom" });
      
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
      
      page.setDefaultNavigationTimeout(EXTRACTION_TIMEOUT_MS);

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
        timeout: EXTRACTION_TIMEOUT_MS,
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

      const extraction = await page.evaluate(
        ({ selector, maxNodes }) => {
          const target = selector ? document.querySelector(selector) : document.documentElement;
          if (!target) {
            return { ok: false, error: `No element matched selector: ${selector}` } as const;
          }

          let nodeCount = 0;
          let truncated = false;

          const serializeNode = (node: Node): any => {
            if (nodeCount >= maxNodes) {
              truncated = true;
              return null;
            }

            if (node.nodeType === Node.TEXT_NODE) {
              const textValue = node.textContent ?? "";
              if (textValue.trim().length === 0) {
                return null;
              }
              nodeCount += 1;
              return { type: "text", textContent: textValue };
            }

            if (node.nodeType !== Node.ELEMENT_NODE) {
              return null;
            }

            nodeCount += 1;

            const attributes = Array.from((node as Element).attributes).reduce<Record<string, string>>((acc, attr) => {
              acc[attr.name] = attr.value;
              return acc;
            }, {});

            const children: any[] = [];
            for (const child of Array.from(node.childNodes)) {
              if (nodeCount >= maxNodes) {
                truncated = true;
                break;
              }
              const serializedChild = serializeNode(child);
              if (serializedChild) {
                children.push(serializedChild);
              }
            }

            return {
              type: "element",
              tagName: (node as Element).tagName.toLowerCase(),
              attributes,
              children,
            };
          };

          const domTree = serializeNode(target);

          if (!domTree) {
            return { ok: false, error: "Unable to serialize DOM tree." } as const;
          }

          return {
            ok: true,
            payload: {
              html: (target as Element).outerHTML ?? new XMLSerializer().serializeToString(target),
              text: target.textContent ?? "",
              domTree,
              nodeCount,
              truncated,
            },
          } as const;
        },
        { selector: args.selector, maxNodes: MAX_DOM_NODES },
      );

      if (!extraction.ok) {
        throw new Error(extraction.error);
      }

      await telemetry.emitTelemetry("dom.extracted", {
        url: args.url,
        selector: args.selector,
        nodeCount: extraction.payload.nodeCount,
        truncated: extraction.payload.truncated,
      });

      // Store DOM data if storage target is specified
      let storageLocation: string | undefined;
      if (args.storageTarget) {
        const storage = getStorageTarget(args.storageTarget) || getDefaultStorageTarget(logger);
        const storageData = JSON.stringify({
          url: args.url,
          selector: args.selector,
          html: extraction.payload.html,
          text: extraction.payload.text,
          domTree: extraction.payload.domTree,
          nodeCount: extraction.payload.nodeCount,
          truncated: extraction.payload.truncated,
          capturedAt: new Date().toISOString(),
        });
        
        const storageResult = await storage.save(Buffer.from(storageData), {
          mimeType: "application/json",
          contentType: "dom-extraction",
          timestamp: new Date().toISOString(),
          tags: {
            url: args.url,
            selector: args.selector || "document",
            viewport: `${viewport.width}x${viewport.height}`,
          },
        });
        storageLocation = storageResult.location;
      }

      return {
        url: args.url,
        selector: args.selector,
        html: extraction.payload.html,
        text: extraction.payload.text,
        domTree: extraction.payload.domTree,
        nodeCount: extraction.payload.nodeCount,
        truncated: extraction.payload.truncated,
        capturedAt: new Date().toISOString(),
        viewportPreset: args.viewport?.preset,
        retryAttempts,
        storageLocation,
      };
    } catch (error) {
      logger.error("extractDom:puppeteerError", { error: (error as Error).message });
      throw error;
    } finally {
      await telemetry.emitTelemetry("browser.closed", { tool: "extractDom" });
      await browser.close();
    }
  };
  
  // Wrap with retry logic
  return withRetry(executeExtraction, {
    policy: retryPolicy,
    logger,
    context: "extractDom",
  }).then(result => {
    // Track retry attempts
    retryAttempts = result.retryAttempts || 0;
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

function buildDomContent(result: ExtractDomResult) {
  const htmlPayload = createBoundedPayload(result.html, MAX_HTML_CHARS);
  const textPayload = createBoundedPayload(result.text, MAX_TEXT_CHARS);
  const domTreeJson = JSON.stringify(result.domTree, null, 2);

  return [
    {
      type: "text" as const,
      text: formatDomSummary(result, {
        htmlTruncated: htmlPayload.truncated,
        textTruncated: textPayload.truncated,
      }),
    },
    {
      type: "text" as const,
      text: `HTML${htmlPayload.truncated ? " (truncated)" : ""}:\n${htmlPayload.value}`,
    },
    {
      type: "text" as const,
      text: `Text${textPayload.truncated ? " (truncated)" : ""}:\n${textPayload.value}`,
    },
    {
      type: "text" as const,
      text: `DOM tree (${result.truncated ? "partial" : "complete"}):\n${domTreeJson}`,
    },
  ];
}

function createBoundedPayload(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return { value, truncated: false };
  }

  return {
    value: `${value.slice(0, maxLength)}…`,
    truncated: true,
  };
}

function formatDomSummary(
  result: ExtractDomResult,
  options: { htmlTruncated: boolean; textTruncated: boolean },
): string {
  const lines = [
    "mcp-page-capture DOM extraction",
    `URL: ${result.url}`,
    `Selector: ${result.selector ?? "<document>"}`,
    `Captured: ${result.capturedAt}`,
    `Nodes serialized: ${result.nodeCount}${result.truncated ? " (truncated)" : ""}`,
    `HTML truncated: ${options.htmlTruncated}`,
    `Text truncated: ${options.textTruncated}`,
  ];
  
  if (result.viewportPreset) {
    lines.push(`Viewport preset: ${result.viewportPreset}`);
  }
  
  if (result.retryAttempts && result.retryAttempts > 0) {
    lines.push(`Retry attempts: ${result.retryAttempts}`);
  }
  
  if (result.storageLocation) {
    lines.push(`Stored at: ${result.storageLocation}`);
  }
  
  return lines.join("\n");
}
