/**
 * MCP Page-Capture Schema - Single Source of Truth
 * 
 * DESIGN PRINCIPLES FOR LLM OPTIMIZATION:
 * 1. Exactly 6 primary step types (no more, no less)
 * 2. Consistent parameter naming across all steps:
 *    - `target` = element to act on (fill, click)
 *    - `for` = element to wait for (wait)
 *    - `to` = destination to navigate to (scroll)
 *    - `element` = element to capture (screenshot)
 * 3. Smart defaults - minimal required parameters
 * 4. Clear, scannable descriptions with (required)/(optional) markers
 * 5. No ambiguous OR logic exposed to LLMs
 * 6. Enum constraints for known values to prevent hallucination
 * 7. STRICT schema isolation - LLM schema never exposes internal/legacy types
 * 8. Single-purpose parameters - no dual meanings
 * 9. Step order enforcement with helpful warnings
 * 10. Validate mode for pre-flight checking
 */

import { z } from "zod";

// ============================================
// DEVICE PRESETS (Enum to prevent hallucination)
// ============================================

/**
 * Common device presets for viewport configuration.
 * Using enum prevents LLMs from hallucinating invalid device names.
 */
/**
 * Top 15 device presets optimized for LLM usage.
 * Generic aliases (mobile/tablet/desktop) map to latest devices.
 * Use custom width/height for unlisted devices.
 */
export const DEVICE_PRESETS = [
  // Generic aliases (recommended - always map to latest)
  "mobile",      // → iPhone 16 Pro
  "tablet",      // → iPad Pro 13
  "desktop",     // → 1920x1080
  // Popular phones
  "iphone-16-pro",
  "iphone-14",
  "pixel-9",
  "galaxy-s24",
  // Popular tablets
  "ipad-pro",
  "ipad-air",
  "surface-pro",
  // Desktop sizes
  "desktop-fhd", // 1920x1080
  "desktop-hd",  // 1280x720
  "desktop-4k",  // 3840x2160
  "macbook-pro-16",
  "macbook-air",
] as const;

export type DevicePreset = typeof DEVICE_PRESETS[number];
export const devicePresetSchema = z.enum(DEVICE_PRESETS);

// ============================================
// SHARED SCHEMAS (Used by multiple tools)
// ============================================

export const headersSchema = z
  .record(z.string().min(1), z.string().min(1))
  .optional()
  .describe("(optional) HTTP headers for auth (e.g., { 'Authorization': 'Bearer token' })");

export const cookieSchema = z.object({
  name: z.string().min(1).describe("(required) Cookie name"),
  value: z.string().describe("(required) Cookie value"),
  domain: z.string().optional().describe("(optional) Cookie domain"),
  path: z.string().optional().describe("(optional) Cookie path"),
  secure: z.boolean().optional().describe("(optional) HTTPS only"),
  httpOnly: z.boolean().optional().describe("(optional) HTTP only (no JS access)"),
  sameSite: z.enum(["Strict", "Lax", "None"]).optional().describe("(optional) SameSite policy"),
  expires: z.number().optional().describe("(optional) Unix timestamp in seconds"),
});

// ============================================
// 6 PRIMARY STEP TYPES (LLM-Exposed)
// ============================================

/**
 * VIEWPORT - Set device/screen size
 * Must be FIRST step if used
 * 
 * Parameter: `device` - the device preset to emulate
 */
export const viewportStepSchema = z.object({
  type: z.literal("viewport"),
  device: devicePresetSchema.optional()
    .describe("(optional) Device preset: 'mobile', 'tablet', 'desktop', 'iphone-16-pro', 'pixel-9', 'galaxy-s24', 'ipad-pro'"),
  width: z.number().positive().max(7680).optional()
    .describe("(optional) Custom width in pixels (1-7680, overrides device)"),
  height: z.number().positive().max(4320).optional()
    .describe("(optional) Custom height in pixels (1-4320, overrides device)"),
}).describe("Set viewport/device. Auto-moved to first position if needed.");

/**
 * WAIT - Wait for element or fixed duration
 * Use before interacting with dynamic content
 * 
 * Parameter: `for` - semantic naming ("wait FOR this element")
 * Parameter: `duration` - fixed delay in ms (use when no selector available)
 */
export const waitStepSchema = z.object({
  type: z.literal("wait"),
  for: z.string().min(1).optional()
    .describe("(optional) CSS selector to wait for (e.g., '.loaded', '#content')"),
  duration: z.number().min(0).max(30000).optional()
    .describe("(optional) Fixed wait in ms (0-30000). Use when no selector available."),
  timeout: z.number().min(0).max(30000).optional()
    .describe("(optional) Max wait time in ms (0-30000). Default: 10000. Only used with 'for'."),
}).describe("Wait for element OR fixed duration. Provide 'for' (selector) OR 'duration' (ms). Prefer 'for' when possible.");

// Runtime wait step that also accepts duration (for backward compat with delay)
export const waitStepRuntimeSchema = z.object({
  type: z.literal("wait"),
  for: z.string().optional(),
  timeout: z.number().min(0).max(30000).optional(),
  duration: z.number().min(0).max(30000).optional(),
});

/**
 * FILL - Fill a form field
 * Auto-detects field type (text, select, checkbox, radio)
 * 
 * Parameter: `target` - the element to act on
 */
export const fillStepSchema = z.object({
  type: z.literal("fill"),
  target: z.string().min(1)
    .describe("(required) CSS selector for input (e.g., '#email', 'input[name=q]')"),
  value: z.string()
    .describe("(required) Value to enter. Checkbox: 'true'/'false'. Select: option value."),
  submit: z.boolean().optional()
    .describe("(optional) Press Enter after filling. Default: false"),
}).describe("Fill form field. Auto-detects type (text/select/checkbox/radio). Errors: ELEMENT_NOT_FOUND, FILL_FAILED.");

/**
 * CLICK - Click an element
 * Add 'waitFor' parameter if click loads new content
 * 
 * Parameter: `target` - the element to act on
 * Parameter: `waitFor` - consistent with wait step's `for` parameter
 */
export const clickStepSchema = z.object({
  type: z.literal("click"),
  target: z.string().min(1)
    .describe("(required) CSS selector to click (e.g., 'button.submit', '#login')"),
  waitFor: z.string().optional()
    .describe("(optional) CSS selector to wait for after click (for dynamic content)"),
}).describe("Click element. Add 'waitFor' if click loads new content. Errors: ELEMENT_NOT_FOUND, ELEMENT_NOT_VISIBLE.");

/**
 * SCROLL - Scroll the page
 * Use 'to' for element, 'y' for pixel position
 * 
 * Parameter: `to` - semantic naming ("scroll TO this element")
 */
export const scrollStepSchema = z.object({
  type: z.literal("scroll"),
  to: z.string().optional()
    .describe("(optional) CSS selector to scroll into view (e.g., '#section-2')"),
  y: z.number().min(0).max(100000).optional()
    .describe("(optional) Vertical scroll position in pixels (0-100000, ignored if 'to' is set)"),
}).describe("Scroll page. Use 'to' for element, 'y' for pixels. Errors: ELEMENT_NOT_FOUND (if 'to' used).");

/**
 * SCREENSHOT - Capture screenshot
 * Auto-added at end if omitted
 * 
 * Parameter: `element` - the element to capture (scoped capture)
 */
export const screenshotStepSchema = z.object({
  type: z.literal("screenshot"),
  fullPage: z.boolean().optional()
    .describe("(optional) Capture entire scrollable page. Default: false"),
  element: z.string().optional()
    .describe("(optional) CSS selector to capture specific element only"),
}).describe("Capture screenshot. Auto-added at end if omitted. Errors: ELEMENT_NOT_FOUND (if 'element' used).");

// ============================================
// LLM SCHEMA - Discriminated Union of 6 Types
// ============================================

export const llmStepSchema = z.discriminatedUnion("type", [
  viewportStepSchema,
  waitStepSchema,
  fillStepSchema,
  clickStepSchema,
  scrollStepSchema,
  screenshotStepSchema,
]);

export type LLMStep = z.infer<typeof llmStepSchema>;
export type ViewportStep = z.infer<typeof viewportStepSchema>;
export type WaitStep = z.infer<typeof waitStepSchema>;
export type FillStep = z.infer<typeof fillStepSchema>;
export type ClickStep = z.infer<typeof clickStepSchema>;
export type ScrollStep = z.infer<typeof scrollStepSchema>;
export type ScreenshotStep = z.infer<typeof screenshotStepSchema>;

// ============================================
// INTERNAL/ADVANCED STEPS (Not exposed to LLMs)
// Runtime accepts these for backward compatibility
// ============================================

export const delayStepSchema = z.object({
  type: z.literal("delay"),
  duration: z.number().min(0).max(30000)
    .describe("(required) Duration in ms"),
}).describe("@internal Fixed delay. Prefer 'wait' with selector.");

export const cookieStepSchema = z.object({
  type: z.literal("cookie"),
  action: z.enum(["set", "delete"]).describe("(required) Action: 'set' or 'delete'"),
  name: z.string().min(1).describe("(required) Cookie name"),
  value: z.string().optional().describe("(optional) Cookie value (required for 'set')"),
  domain: z.string().optional().describe("(optional) Cookie domain"),
  path: z.string().optional().describe("(optional) Cookie path"),
  secure: z.boolean().optional().describe("(optional) HTTPS only"),
  httpOnly: z.boolean().optional().describe("(optional) HTTP only"),
  sameSite: z.enum(["Strict", "Lax", "None"]).optional().describe("(optional) SameSite policy"),
  expires: z.number().optional().describe("(optional) Unix timestamp"),
}).describe("@internal Manage cookies.");

export const storageStepSchema = z.object({
  type: z.literal("storage"),
  storageType: z.enum(["localStorage", "sessionStorage"]).describe("(required) Storage type"),
  action: z.enum(["set", "delete", "clear"]).describe("(required) Action to perform"),
  key: z.string().optional().describe("(optional) Storage key (required for 'set'/'delete')"),
  value: z.string().optional().describe("(optional) Value (required for 'set')"),
}).describe("@internal Manage web storage.");

export const evaluateStepSchema = z.object({
  type: z.literal("evaluate"),
  script: z.string().describe("(required) JavaScript code to execute"),
}).describe("@internal Execute JavaScript.");

export const hoverStepSchema = z.object({
  type: z.literal("hover"),
  target: z.string().min(1).describe("(required) CSS selector to hover"),
  duration: z.number().min(0).max(5000).optional().describe("(optional) Hover duration in ms"),
}).describe("@internal Hover over element.");

export const typeStepSchema = z.object({
  type: z.literal("type"),
  target: z.string().min(1).describe("(required) CSS selector for input"),
  text: z.string().describe("(required) Text to type"),
  pressEnter: z.boolean().optional().describe("(optional) Press Enter after typing"),
  delay: z.number().min(0).max(500).optional().describe("(optional) Delay between keystrokes in ms"),
}).describe("@internal Type with keyboard simulation.");

// Legacy step types for backward compatibility
export const waitForSelectorStepSchema = z.object({
  type: z.literal("waitForSelector"),
  awaitElement: z.string().min(1).describe("(required) CSS selector to wait for"),
  timeout: z.number().optional().describe("(optional) Timeout in ms"),
}).describe("@deprecated Use 'wait' step instead.");

export const fullPageStepSchema = z.object({
  type: z.literal("fullPage"),
  enabled: z.boolean().describe("(required) Enable full page capture"),
}).describe("@deprecated Use screenshot.fullPage instead.");

export const quickFillStepSchema = z.object({
  type: z.literal("quickFill"),
  target: z.string().min(1).describe("(required) CSS selector"),
  value: z.string().describe("(required) Value to fill"),
  submit: z.boolean().optional().describe("(optional) Submit after fill"),
}).describe("@deprecated Use 'fill' step instead.");

export const fillFormStepSchema = z.object({
  type: z.literal("fillForm"),
  fields: z.array(z.object({
    selector: z.string().min(1).describe("(required) CSS selector"),
    value: z.string().describe("(required) Value to fill"),
    type: z.string().optional().describe("(optional) Field type hint"),
    matchByText: z.boolean().optional().describe("(optional) Match select by text"),
    delay: z.number().optional().describe("(optional) Typing delay"),
  })).min(1).describe("(required) Array of fields to fill"),
  formSelector: z.string().optional().describe("(optional) Form container selector"),
  submit: z.boolean().optional().describe("(optional) Submit form after filling"),
  submitSelector: z.string().optional().describe("(optional) Submit button selector"),
  waitForNavigation: z.boolean().optional().describe("(optional) Wait for navigation"),
}).describe("@deprecated Use multiple 'fill' steps instead.");

// ============================================
// RUNTIME SCHEMA - Accepts all step types
// ============================================

export const runtimeStepSchema = z.discriminatedUnion("type", [
  // Primary (LLM-exposed)
  viewportStepSchema,
  waitStepSchema,
  fillStepSchema,
  clickStepSchema,
  scrollStepSchema,
  screenshotStepSchema,
  // Internal/Advanced
  delayStepSchema,
  cookieStepSchema,
  storageStepSchema,
  evaluateStepSchema,
  hoverStepSchema,
  typeStepSchema,
  // Legacy (deprecated)
  waitForSelectorStepSchema,
  fullPageStepSchema,
  quickFillStepSchema,
  fillFormStepSchema,
]);

export type RuntimeStep = z.infer<typeof runtimeStepSchema>;

// ============================================
// TOOL INPUT SCHEMAS
// ============================================

/**
 * captureScreenshot input schema (LLM-exposed)
 * Only 4 parameters: url, steps, headers, validate
 */
export const captureScreenshotInputSchema = z.object({
  url: z.string().min(1)
    .describe("(required) Webpage URL to capture"),
  steps: z.array(llmStepSchema).optional()
    .describe("(optional) Steps to execute before capture. Order: viewport → wait → fill → click → scroll → screenshot"),
  headers: headersSchema,
  validate: z.boolean().optional()
    .describe("(optional) Validate steps without executing. Returns analysis of step order and potential issues."),
});

/**
 * extractDom input schema (LLM-exposed)
 * Only 2 parameters: url, selector
 */
export const extractDomInputSchema = z.object({
  url: z.string().min(1)
    .describe("(required) Webpage URL to extract DOM from"),
  selector: z.string().min(1).optional()
    .describe("(optional) CSS selector to scope extraction (e.g., 'main', '#content')"),
});

// ============================================
// TOOL DESCRIPTIONS (Optimized for LLM scanning)
// ============================================

/** Short description for tool listing (under 80 chars) */
export const CAPTURE_SCREENSHOT_SHORT = "Capture webpage screenshot with optional interactions";

/** Full description for tool execution context */
export const CAPTURE_SCREENSHOT_DESCRIPTION = `Capture webpage screenshot with optional pre-capture interactions.

PARAMS:
• url (required): Page URL
• steps (optional): Array of 6 step types (order auto-fixed)
• headers (optional): HTTP auth headers
• validate (optional): Dry-run step validation

6 STEPS (all optional, order doesn't matter):
• viewport: { device: "mobile" } - Set device/screen
• wait: { for: ".loaded" } or { duration: 2000 } - Wait for element or time
• fill: { target: "#email", value: "a@b.com" } - Fill form field
• click: { target: "#btn", waitFor: ".result" } - Click element
• scroll: { to: "#footer" } or { y: 500 } - Scroll page
• screenshot: { fullPage: true } - Capture (auto-added if omitted)

COMMON ERRORS & FIXES:
• ELEMENT_NOT_FOUND → Add wait step before the failing step
• ELEMENT_NOT_VISIBLE → Add scroll step before the failing step

EXAMPLE: { "url": "...", "steps": [{ "type": "fill", "target": "#email", "value": "a@b.com" }, { "type": "click", "target": "#submit", "waitFor": ".dashboard" }] }`;

/** Short description for tool listing */
export const EXTRACT_DOM_SHORT = "Extract HTML, text, and DOM structure from webpage";

/** Full description for tool execution context */
export const EXTRACT_DOM_DESCRIPTION = `Extract HTML, text, and DOM structure from a webpage.

USE WHEN: Need text content for analysis, DOM structure for selector discovery, or pre-capture page validation.
USE captureScreenshot WHEN: Need visual verification or rendered UI.

• url (required): Page URL
• selector (optional): CSS selector to scope extraction (e.g., 'main', 'article')

EXAMPLE: { "url": "https://example.com", "selector": "article" }`;

// ============================================
// COMPOSITE PATTERNS (High-level convenience)
// ============================================

/**
 * Login pattern - expands to fill + fill + click steps
 * Reduces token count and error surface for common auth flows
 */
export const loginPatternSchema = z.object({
  type: z.literal("login"),
  email: z.object({
    selector: z.string().min(1).describe("CSS selector for email/username field"),
    value: z.string().describe("Email or username value"),
  }),
  password: z.object({
    selector: z.string().min(1).describe("CSS selector for password field"),
    value: z.string().describe("Password value"),
  }),
  submit: z.string().min(1).describe("CSS selector for submit button"),
  successIndicator: z.string().min(1).describe("CSS selector that appears after successful login"),
}).describe("Login pattern: auto-expands to fill email, fill password, click submit, wait for success.");

/**
 * Search pattern - expands to fill + wait steps
 * Common for search functionality
 */
export const searchPatternSchema = z.object({
  type: z.literal("search"),
  input: z.string().min(1).describe("CSS selector for search input"),
  query: z.string().describe("Search query text"),
  resultsIndicator: z.string().min(1).describe("CSS selector for results container"),
  submit: z.boolean().optional().describe("Press Enter to submit (default: true)"),
}).describe("Search pattern: auto-expands to fill search box, submit, wait for results.");

/** Combined step schema including composite patterns */
export const llmStepWithPatternsSchema = z.discriminatedUnion("type", [
  viewportStepSchema,
  waitStepSchema,
  fillStepSchema,
  clickStepSchema,
  scrollStepSchema,
  screenshotStepSchema,
  loginPatternSchema,
  searchPatternSchema,
]);

export type LoginPattern = z.infer<typeof loginPatternSchema>;
export type SearchPattern = z.infer<typeof searchPatternSchema>;
export type LLMStepWithPatterns = z.infer<typeof llmStepWithPatternsSchema>;
