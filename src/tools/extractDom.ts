import puppeteer from "puppeteer";
import { z } from "zod";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { Logger } from "../logger.js";
import type { ExtractDomInput, ExtractDomResult } from "../types/dom.js";
import { normalizeHeadersInput, toPuppeteerCookies } from "../utils/requestOptions.js";
import { normalizeUrl } from "../utils/url.js";

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
      logger.info("extractDom:requested", { url: input.url, selector: input.selector ?? null });

      try {
        const result = await runDomExtraction(input, logger);

        return {
          content: buildDomContent(result),
        };
      } catch (error) {
        logger.error("extractDom:failed", {
          url: input.url,
          selector: input.selector ?? null,
          reason: (error as Error).message,
        });

        throw new McpError(ErrorCode.InvalidParams, "extractDom failed", {
          url: input.url,
          detail: (error as Error).message,
        });
      }
    },
  );
}

export async function runDomExtraction(args: ExtractDomInput, logger: Logger): Promise<ExtractDomResult> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(DEFAULT_VIEWPORT);
    page.setDefaultNavigationTimeout(EXTRACTION_TIMEOUT_MS);

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
      timeout: EXTRACTION_TIMEOUT_MS,
    });

    if (!response || !response.ok()) {
      throw new Error(`Navigation failed with status: ${response?.status() ?? "unknown"}`);
    }

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

    return {
      url: args.url,
      selector: args.selector,
      html: extraction.payload.html,
      text: extraction.payload.text,
      domTree: extraction.payload.domTree,
      nodeCount: extraction.payload.nodeCount,
      truncated: extraction.payload.truncated,
      capturedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("extractDom:puppeteerError", { error: (error as Error).message });
    throw error;
  } finally {
    await browser.close();
  }
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
  return [
    "mcp-page-capture DOM extraction",
    `URL: ${result.url}`,
    `Selector: ${result.selector ?? "<document>"}`,
    `Captured: ${result.capturedAt}`,
    `Nodes serialized: ${result.nodeCount}${result.truncated ? " (truncated)" : ""}`,
    `HTML truncated: ${options.htmlTruncated}`,
    `Text truncated: ${options.textTruncated}`,
  ].join("\n");
}
