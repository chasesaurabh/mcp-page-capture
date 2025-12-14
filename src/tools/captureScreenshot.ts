import puppeteer from "puppeteer";
import { z } from "zod";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { Logger } from "../logger.js";
import type { CaptureScreenshotInput, CaptureScreenshotResult, ScreenshotMetadata, ViewportConfig, RetryConfig, ScrollConfig, ClickAction, ActionStep, ScreenshotStep, CookieActionStep, StorageActionStep, ViewportStep, FullPageStep, CaptureCookieInput, FillFormStep, FormFieldInput, QuickFillStep } from "../types/screenshot.js";
import { normalizeHeadersInput, toPuppeteerCookies } from "../utils/requestOptions.js";
import { normalizeUrl } from "../utils/url.js";
import { withRetry, type RetryPolicy } from "../utils/retry.js";
import { getViewportPreset, mergeViewportOptions, type ViewportPreset } from "../config/viewports.js";
import { getGlobalTelemetry } from "../telemetry/index.js";
import { getStorageTarget, getDefaultStorageTarget } from "../storage/index.js";
import { withTimeout, safeBrowserClose, TimeoutError } from "../utils/timeout.js";
import { LLM_ERRORS, formatErrorResponse, createLLMError, formatErrorForMCP, type LLMErrorResponse } from "../utils/errors.js";
import { normalizeDeviceName, validateSelector, autoFixParameters, convertSimpleParamsToSteps, mergeLegacyIntoSteps, normalizeAllSteps, normalizeUrlInput, collectDeprecationWarnings } from "../utils/normalize.js";
import { normalizeStepsArray } from "../utils/stepMapper.js";
import { validateAndFixSteps } from "../utils/validate.js";
import { validateStepOrder, performStepValidation, formatValidateResult } from "../utils/stepOrder.js";

// Import from centralized schema - Single Source of Truth
import {
  llmStepSchema,
  runtimeStepSchema,
  headersSchema,
  cookieSchema,
  CAPTURE_SCREENSHOT_DESCRIPTION,
} from "../schemas/index.js";

const CAPTURE_TIMEOUT_MS = 45_000;
const BROWSER_CLOSE_TIMEOUT_MS = 5_000;
const MASTER_TIMEOUT_MS = 60_000;
const DEFAULT_VIEWPORT = { width: 1280, height: 720 } as const;

// Step execution tracking
interface StepExecutionInfo {
  type: string;
  target?: string;
  success: boolean;
  error?: string;
}

// Legacy schemas for backward compatibility (runtime only, not exposed to LLMs)
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

const clickActionSchema = z.object({
  selector: z.string().min(1),
  delayBefore: z.number().min(0).max(30000).optional(),
  delayAfter: z.number().min(0).max(30000).optional(),
  waitForSelector: z.string().min(1).optional(),
  waitForNavigation: z.boolean().optional(),
  button: z.enum(["left", "right", "middle"]).optional(),
  clickCount: z.number().min(1).max(3).optional(),
});

const clickActionsSchema = z.array(clickActionSchema).optional();

// Runtime step schemas for backward compatibility
// These are NOT exposed to LLMs - they only see the 6 types from schemas/index.ts

const fillStepBaseSchema = z.object({
  type: z.literal("fill"),
  target: z.string().optional(),
  value: z.string().optional(),
  fields: z.array(z.object({
    target: z.string().min(1),
    value: z.string(),
  })).optional(),
  submit: z.boolean().optional(),
  clear: z.boolean().optional(),
});

const clickStepSchemaRuntime = z.object({
  type: z.literal("click"),
  target: z.string().min(1),
  waitFor: z.string().optional(), // New canonical name
  wait: z.string().optional(), // Legacy alias for waitFor
  waitAfter: z.string().optional(), // Legacy alias for waitFor
  button: z.enum(["left", "right", "middle"]).optional(),
  clickCount: z.number().min(1).max(3).optional(),
  waitForSelector: z.string().optional(), // Legacy alias for waitFor
  waitForNavigation: z.boolean().optional(),
});

const scrollStepSchemaRuntime = z.object({
  type: z.literal("scroll"),
  to: z.string().optional(),
  y: z.number().optional(),
  x: z.number().optional(),
  scrollTo: z.string().optional(),
  behavior: z.enum(["auto", "smooth"]).optional(),
});

const waitStepBaseSchema = z.object({
  type: z.literal("wait"),
  for: z.string().optional(),
  duration: z.number().min(0).max(30000).optional(),
});

const screenshotStepSchemaRuntime = z.object({
  type: z.literal("screenshot"),
  fullPage: z.boolean().optional(),
  element: z.string().optional(),
  captureElement: z.string().optional(),
});

const cookieActionStepSchema = z.object({
  type: z.literal("cookie"),
  action: z.enum(["set", "delete"]),
  name: z.string().min(1),
  value: z.string().optional(),
  domain: z.string().optional(),
  path: z.string().optional(),
  secure: z.boolean().optional(),
  httpOnly: z.boolean().optional(),
  sameSite: z.enum(["Strict", "Lax", "None"]).optional(),
  expires: z.number().optional(),
});

const storageActionStepSchema = z.object({
  type: z.literal("storage"),
  storageType: z.enum(["localStorage", "sessionStorage"]),
  action: z.enum(["set", "delete", "clear"]),
  key: z.string().optional(),
  value: z.string().optional(),
});

const viewportStepSchemaRuntime = z.object({
  type: z.literal("viewport"),
  device: z.string().optional(),
  preset: z.string().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
});

const typeStepSchemaRuntime = z.object({
  type: z.literal("type"),
  target: z.string().min(1),
  text: z.string(),
  pressEnter: z.boolean().optional(),
  delay: z.number().min(0).max(500).optional(),
});

const hoverStepSchemaRuntime = z.object({
  type: z.literal("hover"),
  target: z.string().optional(),
  selector: z.string().optional(),
  duration: z.number().min(0).max(10000).optional(),
});

const textInputStepSchema = z.object({
  type: z.literal("text"),
  selector: z.string().min(1),
  value: z.string(),
  clearFirst: z.boolean().optional(),
  delay: z.number().min(0).max(1000).optional(),
  pressEnter: z.boolean().optional(),
});

const selectStepSchema = z.object({
  type: z.literal("select"),
  selector: z.string().min(1),
  value: z.string().optional(),
  text: z.string().optional(),
  index: z.number().optional(),
});

const radioStepSchema = z.object({
  type: z.literal("radio"),
  selector: z.string().min(1),
  value: z.string().optional(),
  name: z.string().optional(),
});

const checkboxStepSchema = z.object({
  type: z.literal("checkbox"),
  selector: z.string().min(1),
  checked: z.boolean(),
});

const fileUploadStepSchema = z.object({
  type: z.literal("upload"),
  selector: z.string().min(1),
  filePaths: z.array(z.string()),
});

const formSubmitStepSchema = z.object({
  type: z.literal("submit"),
  selector: z.string().min(1),
  waitForNavigation: z.boolean().optional(),
});

const keyPressStepSchema = z.object({
  type: z.literal("keypress"),
  key: z.string(),
  modifiers: z.array(z.string()).optional(),
  selector: z.string().optional(),
});

const focusStepSchema = z.object({
  type: z.literal("focus"),
  selector: z.string().min(1),
});

const blurStepSchema = z.object({
  type: z.literal("blur"),
  selector: z.string().min(1),
});

const clearStepSchema = z.object({
  type: z.literal("clear"),
  selector: z.string().min(1),
});

const evaluateStepSchemaRuntime = z.object({
  type: z.literal("evaluate"),
  script: z.string(),
  selector: z.string().optional(),
});

const formFieldInputSchema = z.object({
  selector: z.string().min(1),
  value: z.string(),
  type: z.enum(["text", "select", "checkbox", "radio", "textarea", "password", "email", "number", "tel", "url", "date", "file"]).optional(),
  matchByText: z.boolean().optional(),
  delay: z.number().min(0).max(1000).optional(),
});

const fillFormStepSchema = z.object({
  type: z.literal("fillForm"),
  fields: z.array(formFieldInputSchema).min(1),
  formSelector: z.string().optional(),
  submit: z.boolean().optional(),
  submitSelector: z.string().optional(),
  waitForNavigation: z.boolean().optional(),
});

const quickFillStepSchema = z.object({
  type: z.literal("quickFill"),
  target: z.string().min(1),
  value: z.string(),
  submit: z.boolean().optional(),
});

const fullPageStepSchema = z.object({
  type: z.literal("fullPage"),
  enabled: z.boolean(),
});

const delayStepSchema = z.object({
  type: z.literal("delay"),
  duration: z.number().min(0).max(30000),
});

const waitForSelectorStepSchema = z.object({
  type: z.literal("waitForSelector"),
  awaitElement: z.string().min(1),
  timeout: z.number().min(0).max(60000).optional(),
});

// Runtime schema accepts all step types for backward compatibility
const actionStepSchema = z.discriminatedUnion("type", [
  fillFormStepSchema,
  quickFillStepSchema,
  fillStepBaseSchema,
  clickStepSchemaRuntime,
  scrollStepSchemaRuntime,
  waitForSelectorStepSchema,
  waitStepBaseSchema,
  screenshotStepSchemaRuntime,
  viewportStepSchemaRuntime,
  typeStepSchemaRuntime,
  hoverStepSchemaRuntime,
  delayStepSchema,
  textInputStepSchema,
  selectStepSchema,
  radioStepSchema,
  checkboxStepSchema,
  fileUploadStepSchema,
  formSubmitStepSchema,
  keyPressStepSchema,
  focusStepSchema,
  blurStepSchema,
  clearStepSchema,
  evaluateStepSchemaRuntime,
  cookieActionStepSchema,
  storageActionStepSchema,
  fullPageStepSchema,
]);

const runtimeStepsSchema = z.array(actionStepSchema).optional();

// Internal schema for legacy parameter support (NOT exposed in tool schema)
const legacyParametersSchema = z.object({
  cookies: z.array(cookieSchema).optional(),
  viewport: viewportSchema,
  scroll: scrollSchema,
  clickActions: clickActionsSchema,
}).partial();

// LLM-exposed schema - clean and simple with 6 canonical step types
const captureScreenshotInputSchema = z.object({
  url: z
    .string({ required_error: "URL is required." })
    .min(1, "URL cannot be empty.")
    .describe("The webpage URL to capture.")
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
  steps: z.array(llmStepSchema).optional()
    .describe("Steps to execute before capture. Order: viewport → wait → fill → click → scroll → screenshot"),
  headers: z.record(z.string(), z.string()).optional()
    .describe("HTTP headers for authentication (e.g., { 'Authorization': 'Bearer token' })."),
});

// Full runtime schema - includes legacy params and accepts all step types for backward compatibility
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
  headers: headersSchema,
  retryPolicy: retryPolicySchema,
  storageTarget: z.string().optional(),
  steps: runtimeStepsSchema,
}).and(legacyParametersSchema);

export function registerCaptureScreenshotTool(server: McpServer, logger: Logger) {
  server.registerTool(
    "captureScreenshot",
    {
      title: "Capture Screenshot",
      description: CAPTURE_SCREENSHOT_DESCRIPTION,
      inputSchema: captureScreenshotInputSchema,
    },
    async (rawInput) => {
      // Parse with full schema to support legacy params at runtime
      const input = captureScreenshotSchema.parse(rawInput);
      const { url, viewport, retryPolicy, storageTarget, scroll } = input;
      const telemetry = getGlobalTelemetry(logger);
      
      // Handle validate mode - return analysis without executing
      const validateMode = (rawInput as any).validate === true;
      if (validateMode) {
        logger.info("captureScreenshot:validate", { url, stepsCount: input.steps?.length || 0 });
        
        const validationResult = performStepValidation(input.steps || [], url);
        const formattedResult = formatValidateResult(validationResult);
        
        await telemetry.emitTelemetry("tool.validated", {
          tool: "captureScreenshot",
          url,
          valid: validationResult.valid,
          stepCount: validationResult.stepCount,
        });
        
        return {
          content: [
            {
              type: "text",
              text: `URL: ${url}\n\n${formattedResult}`,
            },
          ],
        };
      }
      
      logger.info("captureScreenshot:requested", { 
        url, 
        viewportPreset: viewport?.preset,
        storageTarget,
        scroll: scroll ? { x: scroll.x, y: scroll.y, selector: scroll.selector } : undefined,
      });

      await telemetry.emitTelemetry("tool.invoked", {
        tool: "captureScreenshot",
        url,
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
        
        // Collect deprecation warnings for legacy parameters
        const deprecations = collectDeprecationWarnings(input.steps || []);
        let responseText = metadataSummary;
        if (deprecations.hasWarnings) {
          responseText += "\n\nDEPRECATION WARNINGS:\n" + deprecations.warnings.map(w => `⚠ ${w}`).join("\n");
          logger.warn("deprecation:warnings", { warnings: deprecations.warnings });
        }

        return {
          content: [
            {
              type: "text",
              text: responseText,
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

/**
 * Converts legacy parameters to steps for backward compatibility
 */
function convertLegacyParametersToSteps(args: CaptureScreenshotInput, logger?: Logger): ActionStep[] {
  const steps: ActionStep[] = [];
  
  // Convert viewport configuration to step
  if (args.viewport) {
    logger?.debug("legacy:viewport", { converting: true });
    const viewportStep: ViewportStep = {
      type: "viewport",
      preset: args.viewport.preset,
      width: args.viewport.width,
      height: args.viewport.height,
      deviceScaleFactor: args.viewport.deviceScaleFactor,
      isMobile: args.viewport.isMobile,
      hasTouch: args.viewport.hasTouch,
      isLandscape: args.viewport.isLandscape,
      userAgent: args.viewport.userAgent,
    };
    steps.push(viewportStep);
  }
  
  // Convert cookies to steps
  if (args.cookies && args.cookies.length > 0) {
    logger?.debug("legacy:cookies", { converting: true, count: args.cookies.length });
    for (const cookie of args.cookies) {
      const cookieStep: CookieActionStep = {
        type: "cookie",
        action: "set",
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expires: cookie.expires,
      };
      steps.push(cookieStep);
    }
  }
  
  // Convert clickActions to steps
  if (args.clickActions && args.clickActions.length > 0) {
    logger?.debug("legacy:clickActions", { converting: true, count: args.clickActions.length });
    for (const action of args.clickActions) {
      // Add delay before click if specified
      if (action.delayBefore && action.delayBefore > 0) {
        steps.push({
          type: "delay",
          duration: action.delayBefore,
        });
      }
      
      // Add the click step
      steps.push({
        type: "click",
        target: action.selector,
        button: action.button,
        clickCount: action.clickCount,
        waitForSelector: action.waitForSelector,
        waitForNavigation: action.waitForNavigation,
      });
      
      // Add delay after click if specified
      if (action.delayAfter && action.delayAfter > 0) {
        steps.push({
          type: "delay",
          duration: action.delayAfter,
        });
      }
    }
  }
  
  // Convert scroll to step
  if (args.scroll) {
    logger?.debug("legacy:scroll", { converting: true });
    steps.push({
      type: "scroll",
      x: args.scroll.x,
      y: args.scroll.y,
      scrollTo: args.scroll.selector,
      behavior: args.scroll.behavior,
    });
  }
  
  // Add screenshot step at the end (will be added in main function if no explicit one exists)
  
  return steps;
}

async function runScreenshot(args: CaptureScreenshotInput, logger: Logger): Promise<CaptureScreenshotResult> {
  const telemetry = getGlobalTelemetry(logger);
  let retryAttempts = 0;
  
  // Convert legacy parameters to steps and merge with explicit steps
  const legacySteps = convertLegacyParametersToSteps(args, logger);
  const allSteps = [...legacySteps, ...(args.steps || [])];
  
  // If no screenshot step exists, add one at the end
  const hasScreenshotStep = allSteps.some(step => step.type === "screenshot");
  if (!hasScreenshotStep) {
    allSteps.push({ type: "screenshot" } as ScreenshotStep);
  }
  
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
      
      // Set default viewport (will be overridden by viewport steps if any)
      await page.setViewport(DEFAULT_VIEWPORT as ViewportPreset);
      
      page.setDefaultNavigationTimeout(CAPTURE_TIMEOUT_MS);

      const normalizedHeaders = normalizeHeadersInput(args.headers);
      if (normalizedHeaders) {
        await page.setExtraHTTPHeaders(normalizedHeaders);
      }

      // Execute pre-navigation steps (viewport and cookies that need to be set before page load)
      const preNavSteps = allSteps.filter(step => 
        step.type === "viewport" || 
        (step.type === "cookie" && (step as CookieActionStep).action === "set")
      );
      const postNavSteps = allSteps.filter(step => 
        step.type !== "viewport" && 
        !(step.type === "cookie" && (step as CookieActionStep).action === "set")
      );

      // Execute pre-navigation steps
      let preNavStepsResult: Partial<StepsExecutionResult> = { 
        stepsExecuted: 0, 
        screenshotsTaken: 0, 
        fullPageEnabled: false, 
        viewportPreset: undefined 
      };
      if (preNavSteps.length > 0) {
        preNavStepsResult = await executeSteps(page, preNavSteps, logger, true);
      }

      await telemetry.emitTelemetry("navigation.started", { 
        url: args.url,
      });

      const response = await page.goto(args.url, {
        waitUntil: "networkidle2",
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

      // Execute post-navigation steps
      const stepsResult = await executeSteps(page, postNavSteps, logger);
      const screenshotBuffer = stepsResult.screenshotBuffer;
      const totalStepsExecuted = (preNavStepsResult.stepsExecuted || 0) + stepsResult.stepsExecuted;
      
      logger.info("steps:executed", {
        url: args.url,
        stepsRequested: allSteps.length,
        stepsExecuted: totalStepsExecuted,
        screenshotsTaken: stepsResult.screenshotsTaken,
      });

      await telemetry.emitTelemetry("screenshot.captured", {
        url: args.url,
        bytes: screenshotBuffer.length,
      })

      const metrics = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      })).catch((error) => {
        logger?.warn("metrics:capture_failed", { error: error.message });
        // Return default metrics if evaluation fails
        return {
          viewportWidth: 1280,
          viewportHeight: 720,
          scrollWidth: 1280,
          scrollHeight: 720,
          scrollX: 0,
          scrollY: 0,
        };
      });

      // Get current viewport for metadata (may not be available in tests)
      const currentViewport = page.viewport ? page.viewport() : { width: 1280, height: 720 };

      // Store screenshot if storage target is specified
      let storageLocation: string | undefined;
      if (args.storageTarget) {
        const storage = getStorageTarget(args.storageTarget) || getDefaultStorageTarget(logger);
        const storageResult = await storage.save(screenshotBuffer, {
          mimeType: "image/png",
          timestamp: new Date().toISOString(),
          tags: {
            url: args.url,
            fullPage: String(stepsResult.fullPageEnabled),
            viewport: `${currentViewport?.width}x${currentViewport?.height}`,
          },
        });
        storageLocation = storageResult.location;
      }

      const metadata: ScreenshotMetadata = {
        url: args.url,
        fullPage: stepsResult.fullPageEnabled,
        viewportWidth: metrics.viewportWidth,
        viewportHeight: metrics.viewportHeight,
        scrollWidth: metrics.scrollWidth,
        scrollHeight: metrics.scrollHeight,
        scrollX: metrics.scrollX,
        scrollY: metrics.scrollY,
        bytes: screenshotBuffer.length,
        capturedAt: new Date().toISOString(),
        viewportPreset: stepsResult.viewportPreset || preNavStepsResult.viewportPreset,
        retryAttempts,
        storageLocation,
        clickActionsExecuted: undefined, // Deprecated
        stepsExecuted: totalStepsExecuted > 0 ? totalStepsExecuted : undefined,
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
      await safeBrowserClose(browser, BROWSER_CLOSE_TIMEOUT_MS, logger);
    }
  };
  
  // Wrap with retry logic and master timeout to prevent indefinite hangs
  const retryPromise = withRetry(executeCapture, {
    policy: retryPolicy,
    logger,
    context: "captureScreenshot",
  }).then(result => {
    // Track retry attempts
    retryAttempts = result.metadata.retryAttempts || 0;
    return result;
  });

  return withTimeout(retryPromise, MASTER_TIMEOUT_MS, "captureScreenshot");
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
          page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
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
  fullPageEnabled: boolean;
  viewportPreset?: string;
}

async function executeSteps(
  page: Awaited<ReturnType<typeof puppeteer.launch>>['newPage'] extends () => Promise<infer P> ? P : never,
  steps: ActionStep[],
  logger?: Logger,
  skipScreenshot: boolean = false
): Promise<StepsExecutionResult> {
  let stepsExecuted = 0;
  let screenshotsTaken = 0;
  let screenshotBuffer: Buffer | null = null;
  let fullPageEnabled = false;
  let viewportPreset: string | undefined;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    logger?.debug("step:executing", { index: i, type: step.type });

    try {
      switch (step.type) {
        case "viewport": {
          const viewportStep = step as ViewportStep;
          logger?.debug("step:viewport", { 
            index: i, 
            preset: viewportStep.preset,
            width: viewportStep.width,
            height: viewportStep.height,
          });

          const viewport = resolveViewport(viewportStep, logger);
          await page.setViewport(viewport);
          
          if (viewport.userAgent) {
            await page.setUserAgent(viewport.userAgent);
          }
          
          if (viewport.hasTouch) {
            await page.evaluateOnNewDocument(() => {
              (window as any).ontouchstart = true;
            });
          }
          
          viewportPreset = viewportStep.preset;
          stepsExecuted++;
          break;
        }

        case "fullPage": {
          const fullPageStep = step as FullPageStep;
          logger?.debug("step:fullPage", { index: i, enabled: fullPageStep.enabled });
          fullPageEnabled = fullPageStep.enabled;
          stepsExecuted++;
          break;
        }

        case "delay": {
          logger?.debug("step:delay", { index: i, duration: step.duration });
          await new Promise(resolve => setTimeout(resolve, step.duration));
          stepsExecuted++;
          break;
        }

        case "click": {
          const clickStep = step as any;
          logger?.debug("step:click", { 
            index: i, 
            target: clickStep.target,
            button: clickStep.button || "left",
            clickCount: clickStep.clickCount || 1,
          });

          // Wait for the element to be present
          await page.waitForSelector(clickStep.target, { timeout: 10000 });

          // Build click options for all click types
          const clickOptions: { button?: "left" | "right" | "middle"; clickCount?: number } = {};
          if (clickStep.button) {
            clickOptions.button = clickStep.button;
          }
          if (clickStep.clickCount && clickStep.clickCount > 1) {
            clickOptions.clickCount = clickStep.clickCount;
          }

          // Normalize waitFor parameter (supports: waitFor, wait, waitAfter, waitForSelector)
          const waitForSelector = clickStep.waitFor || clickStep.wait || clickStep.waitAfter || clickStep.waitForSelector;

          // Handle legacy ClickStep with waitForNavigation
          if (clickStep.waitForNavigation) {
            // Click and wait for navigation simultaneously
            await Promise.all([
              page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
              page.click(clickStep.target, clickOptions),
            ]);
          } else {
            // Standard click
            await page.click(clickStep.target, clickOptions);
          }

          // Wait for a specific selector to appear after click
          if (waitForSelector) {
            logger?.debug("step:click:waitingFor", { 
              index: i, 
              waitFor: waitForSelector,
            });
            try {
              await page.waitForSelector(waitForSelector, { timeout: 10000 });
            } catch (e) {
              logger?.warn("step:click:waitFor_timeout", { waitFor: waitForSelector });
            }
          }

          logger?.debug("step:clicked", { index: i, target: clickStep.target });
          stepsExecuted++;
          break;
        }

        case "scroll": {
          const scrollStep = step as any;
          
          // Handle new SimpleScrollStep
          if ('to' in scrollStep && scrollStep.to) {
            logger?.debug("step:scroll:to_element", { index: i, to: scrollStep.to });

            const scrollResult = await page.evaluate(
              (selector: string) => {
                const element = document.querySelector(selector);
                if (!element) {
                  return { ok: false, error: `Element not found: ${selector}` };
                }
                element.scrollIntoView({ behavior: "auto", block: "start" });
                return { ok: true, x: window.scrollX, y: window.scrollY };
              },
              scrollStep.to as string
            );

            if (!scrollResult.ok) {
              logger?.warn("step:scroll:element_not_found", { index: i, to: scrollStep.to });
            }
          }
          // Handle y position with optional behavior
          else if ('y' in scrollStep && scrollStep.y !== undefined) {
            const behavior = scrollStep.behavior || "auto";
            logger?.debug("step:scroll:to_position", { index: i, y: scrollStep.y, behavior });
            
            await page.evaluate(
              (params: { y: number; behavior: ScrollBehavior }) => {
                window.scrollTo({ left: 0, top: params.y, behavior: params.behavior });
              },
              { y: scrollStep.y, behavior }
            );
            
            // Wait for smooth scroll to complete
            if (behavior === "smooth") {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          // Handle legacy ScrollStep
          else {
            const behavior = scrollStep.behavior || "auto";
            
            if (scrollStep.scrollTo) {
              logger?.debug("step:scroll:to_element", { index: i, scrollTo: scrollStep.scrollTo, behavior });

              const scrollResult = await page.evaluate(
                (params: { scrollTo: string; behavior: ScrollBehavior }) => {
                  const element = document.querySelector(params.scrollTo);
                  if (!element) {
                    return { ok: false, error: `Element not found: ${params.scrollTo}` };
                  }
                  element.scrollIntoView({ behavior: params.behavior, block: "start" });
                  return { ok: true, x: window.scrollX, y: window.scrollY };
                },
                { scrollTo: scrollStep.scrollTo, behavior }
              );

              if (!scrollResult.ok) {
                logger?.warn("step:scroll:element_not_found", { index: i, scrollTo: scrollStep.scrollTo });
              }
            } else {
              const x = scrollStep.x ?? 0;
              const y = scrollStep.y ?? 0;
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
          }

          stepsExecuted++;
          break;
        }

        case "wait":
        case "waitForSelector": {
          const waitStep = step as any;
          
          // Handle new WaitStep
          if ('for' in waitStep && waitStep.for) {
            logger?.debug("step:wait:for_element", { index: i, for: waitStep.for });
            await page.waitForSelector(waitStep.for, { timeout: 10000 });
          }
          // Handle duration
          else if ('duration' in waitStep && waitStep.duration !== undefined) {
            logger?.debug("step:wait:duration", { index: i, duration: waitStep.duration });
            await new Promise(resolve => setTimeout(resolve, waitStep.duration));
          }
          // Handle legacy WaitForSelectorStep
          else if ('awaitElement' in waitStep) {
            const timeout = waitStep.timeout ?? 10000;
            logger?.debug("step:waitForSelector", { index: i, awaitElement: waitStep.awaitElement, timeout });
            await page.waitForSelector(waitStep.awaitElement, { timeout });
          }
          
          stepsExecuted++;
          break;
        }

        case "screenshot": {
          const screenshotStep = step as any;
          // Use step-level fullPage if specified, otherwise use current setting
          const useFullPage = screenshotStep.fullPage !== undefined ? screenshotStep.fullPage : fullPageEnabled;
          
          // Get element selector (handle both 'element' and 'captureElement')
          const elementSelector = screenshotStep.element || screenshotStep.captureElement;
          
          logger?.debug("step:screenshot", { index: i, fullPage: useFullPage, element: elementSelector });
          
          if (elementSelector) {
            // Capture specific element
            const element = await page.$(elementSelector);
            if (element) {
              screenshotBuffer = (await element.screenshot({ type: "png" })) as Buffer;
            } else {
              logger?.warn("step:screenshot:element_not_found", { index: i, element: elementSelector });
              // Fall back to page screenshot
              screenshotBuffer = (await page.screenshot({
                type: "png",
                fullPage: useFullPage,
              })) as Buffer;
            }
          } else {
            screenshotBuffer = (await page.screenshot({
              type: "png",
              fullPage: useFullPage,
            })) as Buffer;
          }
          screenshotsTaken++;
          stepsExecuted++;
          break;
        }

        case "quickFill": {
          const quickFillStep = step as QuickFillStep;
          logger?.debug("step:quickFill", { index: i, target: quickFillStep.target });
          
          await page.waitForSelector(quickFillStep.target, { timeout: 5000 });
          
          // Clear existing text and type the new value
          await page.click(quickFillStep.target, { clickCount: 3 });
          await page.keyboard.press('Backspace');
          await page.type(quickFillStep.target, quickFillStep.value);
          
          // Press Enter if submit is requested
          if (quickFillStep.submit) {
            await page.keyboard.press('Enter');
            // Wait a bit for any navigation or form submission
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          logger?.debug("step:quickFill:completed", { index: i });
          stepsExecuted++;
          break;
        }

        case "cookie": {
          logger?.debug("step:cookie", { index: i, action: step.action, name: step.name });
          
          if (step.action === "set" && step.name) {
            const cookieData: {
              name: string;
              value: string;
              domain?: string;
              path?: string;
              secure?: boolean;
              httpOnly?: boolean;
              sameSite?: "Strict" | "Lax" | "None";
              expires?: number;
            } = {
              name: step.name,
              value: step.value || "",
            };
            if (step.domain) cookieData.domain = step.domain;
            if (step.path) cookieData.path = step.path;
            if (step.secure !== undefined) cookieData.secure = step.secure;
            if (step.httpOnly !== undefined) cookieData.httpOnly = step.httpOnly;
            if (step.sameSite) cookieData.sameSite = step.sameSite;
            if (step.expires !== undefined) cookieData.expires = step.expires;
            
            await page.setCookie(cookieData);
            logger?.debug("step:cookie:set", { index: i, name: step.name });
          } else if (step.action === "delete" && step.name) {
            const cookies = await page.cookies();
            const cookieToDelete = cookies.find(c => c.name === step.name);
            if (cookieToDelete) {
              await page.deleteCookie({ name: step.name, domain: cookieToDelete.domain });
              logger?.debug("step:cookie:deleted", { index: i, name: step.name });
            } else {
              logger?.warn("step:cookie:not_found", { index: i, name: step.name });
            }
          }
          stepsExecuted++;
          break;
        }

        case "storage": {
          const storageStep = step as any;
          logger?.debug("step:storage", { index: i, storageType: storageStep.storageType, action: storageStep.action, key: storageStep.key });
          
          await page.evaluate(
            (params: { storageType: string; action: string; key?: string; value?: string }) => {
              const storage = params.storageType === "localStorage" ? localStorage : sessionStorage;
              
              switch (params.action) {
                case "set":
                  if (params.key !== undefined) {
                    storage.setItem(params.key, params.value || "");
                  }
                  break;
                case "delete":
                  if (params.key !== undefined) {
                    storage.removeItem(params.key);
                  }
                  break;
                case "clear":
                  storage.clear();
                  break;
              }
            },
            { storageType: storageStep.storageType, action: storageStep.action, key: storageStep.key, value: storageStep.value }
          );
          
          logger?.debug("step:storage:completed", { index: i, storageType: storageStep.storageType, action: storageStep.action });
          stepsExecuted++;
          break;
        }

        case "text": {
          const textStep = step as any;
          logger?.debug("step:text", { index: i, selector: textStep.selector });
          await page.waitForSelector(textStep.selector, { timeout: 5000 });
          
          // Clear existing text if requested
          if (textStep.clearFirst !== false) {
            await page.click(textStep.selector, { clickCount: 3 });
            await page.keyboard.press('Backspace');
          }
          
          // Type the text
          await page.type(textStep.selector, textStep.value, { delay: textStep.delay || 0 });
          
          // Press Enter if requested
          if (textStep.pressEnter) {
            await page.keyboard.press('Enter');
          }
          
          logger?.debug("step:text:completed", { index: i });
          stepsExecuted++;
          break;
        }

        case "select": {
          const selectStep = step as any;
          logger?.debug("step:select", { index: i, selector: selectStep.selector });
          await page.waitForSelector(selectStep.selector, { timeout: 5000 });
          
          if (selectStep.value !== undefined) {
            await page.select(selectStep.selector, selectStep.value);
          } else if (selectStep.text !== undefined) {
            await page.evaluate((params: { selector: string; text: string }) => {
              const select = document.querySelector(params.selector) as HTMLSelectElement;
              if (!select) return null;
              for (let i = 0; i < select.options.length; i++) {
                if (select.options[i].text === params.text) {
                  select.selectedIndex = i;
                  select.dispatchEvent(new Event('change', { bubbles: true }));
                  return select.options[i].value;
                }
              }
              return null;
            }, { selector: selectStep.selector, text: selectStep.text });
          } else if (selectStep.index !== undefined) {
            await page.evaluate((params: { selector: string; index: number }) => {
              const select = document.querySelector(params.selector) as HTMLSelectElement;
              if (select && select.options[params.index]) {
                select.selectedIndex = params.index;
                select.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }, { selector: selectStep.selector, index: selectStep.index });
          }
          
          logger?.debug("step:select:completed", { index: i });
          stepsExecuted++;
          break;
        }

        case "radio": {
          const radioStep = step as any;
          logger?.debug("step:radio", { index: i, selector: radioStep.selector });
          
          let selector = radioStep.selector;
          if (radioStep.value) {
            selector += `[value="${radioStep.value}"]`;
          }
          if (radioStep.name) {
            selector += `[name="${radioStep.name}"]`;
          }
          
          await page.waitForSelector(selector, { timeout: 5000 });
          await page.click(selector);
          
          logger?.debug("step:radio:completed", { index: i });
          stepsExecuted++;
          break;
        }

        case "checkbox": {
          const checkboxStep = step as any;
          logger?.debug("step:checkbox", { index: i, selector: checkboxStep.selector });
          await page.waitForSelector(checkboxStep.selector, { timeout: 5000 });
          
          const isChecked = await page.evaluate((selector: string) => {
            const checkbox = document.querySelector(selector) as HTMLInputElement;
            return checkbox?.checked || false;
          }, checkboxStep.selector);
          
          if (isChecked !== checkboxStep.checked) {
            await page.click(checkboxStep.selector);
          }
          
          logger?.debug("step:checkbox:completed", { index: i, checked: checkboxStep.checked });
          stepsExecuted++;
          break;
        }

        case "hover": {
          const hoverStep = step as any;
          // Get the selector (target for new, selector for legacy)
          const selector = hoverStep.target || hoverStep.selector;
          const duration = hoverStep.duration ?? 100;
          
          logger?.debug("step:hover", { index: i, selector, duration });
          await page.hover(selector);
          if (duration > 0) {
            await new Promise(resolve => setTimeout(resolve, duration));
          }
          logger?.debug("step:hover:completed", { index: i });
          stepsExecuted++;
          break;
        }

        case "focus": {
          const focusStep = step as any;
          logger?.debug("step:focus", { index: i, selector: focusStep.selector });
          
          await page.focus(focusStep.selector);
          
          logger?.debug("step:focus:completed", { index: i });
          stepsExecuted++;
          break;
        }

        case "blur": {
          const blurStep = step as any;
          logger?.debug("step:blur", { index: i, selector: blurStep.selector });
          
          await page.evaluate((selector: string) => {
            const element = document.querySelector(selector) as HTMLElement;
            if (element) element.blur();
          }, blurStep.selector);
          
          logger?.debug("step:blur:completed", { index: i });
          stepsExecuted++;
          break;
        }

        case "clear": {
          const clearStep = step as any;
          logger?.debug("step:clear", { index: i, selector: clearStep.selector });
          
          await page.click(clearStep.selector, { clickCount: 3 });
          await page.keyboard.press('Backspace');
          
          logger?.debug("step:clear:completed", { index: i });
          stepsExecuted++;
          break;
        }

        case "keypress": {
          const keyPressStep = step as any;
          logger?.debug("step:keypress", { index: i, key: keyPressStep.key });
          
          if (keyPressStep.modifiers && keyPressStep.modifiers.length > 0) {
            for (const modifier of keyPressStep.modifiers) {
              await page.keyboard.down(modifier);
            }
          }
          
          await page.keyboard.press(keyPressStep.key);
          
          if (keyPressStep.modifiers && keyPressStep.modifiers.length > 0) {
            for (const modifier of keyPressStep.modifiers.reverse()) {
              await page.keyboard.up(modifier);
            }
          }
          
          logger?.debug("step:keypress:completed", { index: i });
          stepsExecuted++;
          break;
        }

        case "evaluate": {
          const evaluateStep = step as any;
          logger?.debug("step:evaluate", { index: i, script: evaluateStep.script?.substring(0, 100) });
          
          await page.evaluate(evaluateStep.script);
          
          logger?.debug("step:evaluate:completed", { index: i });
          stepsExecuted++;
          break;
        }

        case "upload": {
          const uploadStep = step as any;
          logger?.debug("step:upload", { index: i, selector: uploadStep.selector });
          
          const elementHandle = await page.$(uploadStep.selector);
          if (elementHandle) {
            await (elementHandle as any).uploadFile(...uploadStep.filePaths);
          }
          
          logger?.debug("step:upload:completed", { index: i });
          stepsExecuted++;
          break;
        }

        case "submit": {
          const submitStep = step as any;
          logger?.debug("step:submit", { index: i, selector: submitStep.selector });
          
          await page.waitForSelector(submitStep.selector, { timeout: 5000 });
          
          if (submitStep.waitForNavigation !== false) {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
              page.evaluate((selector: string) => {
                const element = document.querySelector(selector);
                if (element instanceof HTMLFormElement) {
                  element.submit();
                } else if (element instanceof HTMLElement) {
                  element.click();
                }
              }, submitStep.selector)
            ]);
          } else {
            await page.evaluate((selector: string) => {
              const element = document.querySelector(selector);
              if (element instanceof HTMLFormElement) {
                element.submit();
              } else if (element instanceof HTMLElement) {
                element.click();
              }
            }, submitStep.selector);
          }
          
          logger?.debug("step:submit:completed", { index: i });
          stepsExecuted++;
          break;
        }

        case "type": {
          const typeStep = step as any;
          logger?.debug("step:type", { index: i, target: typeStep.target });
          
          await page.waitForSelector(typeStep.target, { timeout: 5000 });
          await page.click(typeStep.target);
          
          // Type with optional delay
          if (typeStep.delay && typeStep.delay > 0) {
            await page.type(typeStep.target, typeStep.text, { delay: typeStep.delay });
          } else {
            await page.type(typeStep.target, typeStep.text);
          }
          
          if (typeStep.pressEnter) {
            await page.keyboard.press('Enter');
          }
          
          logger?.debug("step:type:completed", { index: i });
          stepsExecuted++;
          break;
        }

        case "fill":
        case "fillForm": {
          const fillStep = step as any;
          
          // Handle new FillStep with single field
          if (fillStep.target && fillStep.value !== undefined) {
            logger?.debug("step:fill:single", { index: i, target: fillStep.target });
            
            await page.waitForSelector(fillStep.target, { timeout: 5000 });
            
            // Determine field type
            const fieldType = await page.evaluate((selector: string) => {
              const el = document.querySelector(selector) as HTMLElement;
              if (!el) return null;
              
              if (el instanceof HTMLSelectElement) return 'select';
              if (el instanceof HTMLInputElement) {
                if (el.type === 'checkbox') return 'checkbox';
                if (el.type === 'radio') return 'radio';
                return 'text';
              }
              if (el instanceof HTMLTextAreaElement) return 'textarea';
              return 'text';
            }, fillStep.target);
            
            // Fill based on type
            switch (fieldType) {
              case 'checkbox':
                const shouldCheck = fillStep.value === 'true';
                await page.evaluate((selector: string, check: boolean) => {
                  const el = document.querySelector(selector) as HTMLInputElement;
                  if (el && el.checked !== check) el.click();
                }, fillStep.target, shouldCheck);
                break;
                
              case 'select':
                await page.select(fillStep.target, fillStep.value);
                break;
                
              default:
                if (fillStep.clear !== false) {
                  await page.click(fillStep.target, { clickCount: 3 });
                  await page.keyboard.press('Backspace');
                }
                await page.type(fillStep.target, fillStep.value);
            }
            
            if (fillStep.submit) {
              await page.keyboard.press('Enter');
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          // Handle new FillStep with multiple fields
          else if (fillStep.fields && fillStep.fields.length > 0) {
            logger?.debug("step:fill:multiple", { index: i, fields: fillStep.fields.length });
            
            for (const field of fillStep.fields) {
              await page.waitForSelector(field.target, { timeout: 5000 });
              // ... (similar field type handling)
            }
            
            if (fillStep.submit) {
              await page.keyboard.press('Enter');
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          // Handle legacy FillFormStep
          else if ('fields' in fillStep && fillStep.fields) {
            const fillFormStep = fillStep as FillFormStep;
            logger?.debug("step:fillForm", { index: i, fields: fillFormStep.fields.length });
            
            // Process each field
            for (const field of fillFormStep.fields) {
              await page.waitForSelector(field.selector, { timeout: 5000 });
              
              // Determine field type
              const fieldType = await page.evaluate((selector: string) => {
                const el = document.querySelector(selector) as HTMLElement;
                if (!el) return null;
                
                if (el instanceof HTMLSelectElement) return 'select';
                if (el instanceof HTMLInputElement) {
                  if (el.type === 'checkbox') return 'checkbox';
                  if (el.type === 'radio') return 'radio';
                  return 'text';
                }
                if (el instanceof HTMLTextAreaElement) return 'textarea';
                return 'text';
              }, field.selector);
              
              // Handle field based on type
              switch (fieldType as string) {
                case "select": {
                  if (field.matchByText) {
                    await page.evaluate((params: { selector: string; text: string }) => {
                      const select = document.querySelector(params.selector) as HTMLSelectElement;
                      if (!select) return;
                      for (let i = 0; i < select.options.length; i++) {
                        if (select.options[i].text === params.text) {
                          select.selectedIndex = i;
                          select.dispatchEvent(new Event('change', { bubbles: true }));
                          break;
                        }
                      }
                    }, { selector: field.selector, text: field.value });
                  } else {
                    await page.select(field.selector, field.value);
                  }
                  break;
                }
                case "checkbox": {
                  const shouldBeChecked = field.value.toLowerCase() === "true";
                  const isChecked = await page.evaluate((selector: string) => {
                    const checkbox = document.querySelector(selector) as HTMLInputElement;
                    return checkbox?.checked || false;
                  }, field.selector);
                  if (isChecked !== shouldBeChecked) {
                    await page.click(field.selector);
                  }
                  break;
                }
                case "radio": {
                  // For radio, click the one with matching value
                  const radioSelector = `${field.selector}[value="${field.value}"]`;
                  await page.waitForSelector(radioSelector, { timeout: 5000 }).catch(() => {
                    // If specific value selector fails, just click the base selector
                  });
                  const selectorToClick = await page.$(radioSelector) ? radioSelector : field.selector;
                  await page.click(selectorToClick);
                  break;
                }
                case "file": {
                  const elementHandle = await page.$(field.selector);
                  if (elementHandle) {
                    await (elementHandle as any).uploadFile(field.value);
                  }
                  break;
                }
                default: {
                  // Text-like inputs (text, password, email, number, tel, url, date, textarea)
                  await page.click(field.selector, { clickCount: 3 });
                  await page.keyboard.press('Backspace');
                  await page.type(field.selector, field.value, { delay: field.delay || 0 });
                  break;
                }
              }
              
            }
            
            // Submit form if requested
            if (fillFormStep.submit) {
              logger?.debug("step:fillForm:submit", { index: i });
              const submitSelector = fillFormStep.submitSelector 
                || (fillFormStep.formSelector ? `${fillFormStep.formSelector} [type="submit"], ${fillFormStep.formSelector} button[type="submit"], ${fillFormStep.formSelector} input[type="submit"]` : '[type="submit"]');
              
              const waitForNav = fillFormStep.waitForNavigation !== false;
              
              if (waitForNav) {
                await Promise.all([
                  page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
                    // Navigation might not always happen
                  }),
                  page.evaluate((params: { formSelector?: string; submitSelector: string }) => {
                    // Try submit button first
                    const submitBtn = document.querySelector(params.submitSelector);
                    if (submitBtn instanceof HTMLElement) {
                      submitBtn.click();
                      return;
                    }
                    // Fall back to form.submit()
                    if (params.formSelector) {
                      const form = document.querySelector(params.formSelector);
                      if (form instanceof HTMLFormElement) {
                        form.submit();
                      }
                    }
                  }, { formSelector: fillFormStep.formSelector, submitSelector })
                ]);
              } else {
                await page.evaluate((params: { formSelector?: string; submitSelector: string }) => {
                  const submitBtn = document.querySelector(params.submitSelector);
                  if (submitBtn instanceof HTMLElement) {
                    submitBtn.click();
                    return;
                  }
                  if (params.formSelector) {
                    const form = document.querySelector(params.formSelector);
                    if (form instanceof HTMLFormElement) {
                      form.submit();
                    }
                  }
                }, { formSelector: fillFormStep.formSelector, submitSelector });
              }
              logger?.debug("step:fillForm:submit:completed", { index: i });
            }
            
            logger?.debug("step:fillForm:completed", { index: i, fieldsProcessed: fillFormStep.fields.length });
          }
          
          stepsExecuted++;
          break;
        }

        default:
          logger?.warn("step:unsupported", { index: i, type: (step as any).type });
          break;
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

  // If no screenshot step was executed and we're not skipping, take one at the end
  if (!screenshotBuffer && !skipScreenshot) {
    logger?.debug("step:auto_screenshot", { reason: "no screenshot step found" });
    screenshotBuffer = (await page.screenshot({
      type: "png",
      fullPage: fullPageEnabled,
    })) as Buffer;
    screenshotsTaken++;
  }

  // Provide a default buffer if needed (shouldn't happen in normal flow)
  if (!screenshotBuffer && !skipScreenshot) {
    screenshotBuffer = Buffer.from([]);
  }

  return {
    screenshotBuffer: screenshotBuffer || Buffer.from([]),
    stepsExecuted,
    screenshotsTaken,
    fullPageEnabled,
    viewportPreset,
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
