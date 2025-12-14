export interface CaptureCookieInput {
  name: string;
  value: string;
  url?: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  expires?: number;
}

export interface ViewportConfig {
  preset?: string;
  width?: number;
  height?: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
  isLandscape?: boolean;
  userAgent?: string;
}

export interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableStatusCodes?: number[];
  retryableErrors?: string[];
}

export interface ScrollConfig {
  x?: number;
  y?: number;
  selector?: string;
  behavior?: "auto" | "smooth";
}

export interface ClickAction {
  selector: string;
  delayBefore?: number;
  delayAfter?: number;
  waitForSelector?: string;
  waitForNavigation?: boolean;
  button?: "left" | "right" | "middle";
  clickCount?: number;
}

// ============================================
// RECOMMENDED STEPS (Primary LLM-exposed steps)
// ============================================

/**
 * Delay step - pauses execution for a specified duration.
 * Use when you need to wait for animations or async operations.
 */
export interface DelayStep {
  type: "delay";
  duration: number;
}

export interface ClickStep {
  type: "click";
  /** CSS selector of the element to click */
  target: string;
  button?: "left" | "right" | "middle";
  clickCount?: number;
  waitForSelector?: string;
  waitForNavigation?: boolean;
}

export interface ScrollStep {
  type: "scroll";
  x?: number;
  y?: number;
  /** CSS selector of element to scroll into view */
  scrollTo?: string;
  behavior?: "auto" | "smooth";
}

export interface WaitForSelectorStep {
  type: "waitForSelector";
  /** CSS selector to wait for */
  awaitElement: string;
  timeout?: number;
}

export interface ScreenshotStep {
  type: "screenshot";
  /** Whether to capture the entire scrollable page. If false, captures only the visible viewport. */
  fullPage?: boolean;
  /** CSS selector of specific element to capture instead of full page/viewport. */
  captureElement?: string;
}

// ============================================
// ADVANCED STEPS (Power-user scenarios)
// ============================================

/**
 * Cookie action step - manages browser cookies.
 * Advanced: Consider using headers for auth instead.
 */
export interface CookieActionStep {
  type: "cookie";
  /** The operation to perform on cookies: 'set' to add/update, 'delete' to remove. */
  action: "set" | "delete";
  /** Cookie name. Required for both 'set' and 'delete' operations. */
  name: string;
  /** Cookie value. Required when action is 'set'. */
  value?: string;
  /** The domain the cookie applies to. */
  domain?: string;
  /** The path the cookie applies to. */
  path?: string;
  /** Whether the cookie is secure (HTTPS only). */
  secure?: boolean;
  /** Whether the cookie is HTTP-only (not accessible via JavaScript). */
  httpOnly?: boolean;
  /** The SameSite attribute of the cookie. */
  sameSite?: "Strict" | "Lax" | "None";
  /** Unix timestamp (in seconds) when the cookie expires. */
  expires?: number;
}

export interface StorageActionStep {
  type: "storage";
  /** The storage type to manipulate: 'localStorage' or 'sessionStorage'. */
  storageType: "localStorage" | "sessionStorage";
  /** The operation to perform: 'set' to add/update, 'delete' to remove a key, 'clear' to remove all items. */
  action: "set" | "delete" | "clear";
  /** Storage key. Required for 'set' and 'delete' operations. */
  key?: string;
  /** Storage value. Required when action is 'set'. */
  value?: string;
}

export interface TextInputStep {
  type: "text";
  /** CSS selector for the input element */
  selector: string;
  /** Text to type */
  value: string;
  /** Clear existing text first (default: true) */
  clearFirst?: boolean;
  /** Delay between keystrokes in ms (0-1000) */
  delay?: number;
  /** Press Enter after typing (default: false) */
  pressEnter?: boolean;
}

export interface SelectStep {
  type: "select";
  /** CSS selector for the select element */
  selector: string;
  /** Select by value */
  value?: string;
  /** Select by visible text */
  text?: string;
  /** Select by index */
  index?: number;
}

export interface RadioStep {
  type: "radio";
  /** CSS selector for the radio button */
  selector: string;
  /** Value attribute of the radio button */
  value?: string;
  /** Name attribute to identify the radio group */
  name?: string;
}

export interface CheckboxStep {
  type: "checkbox";
  /** CSS selector for the checkbox */
  selector: string;
  /** Whether to check (true) or uncheck (false) */
  checked: boolean;
}

export interface HoverStep {
  type: "hover";
  /** CSS selector for the element to hover over */
  selector: string;
  /** How long to maintain hover in ms (0-10000) */
  duration?: number;
}

export interface FileUploadStep {
  type: "upload";
  /** CSS selector for the file input element */
  selector: string;
  /** File paths to upload */
  filePaths: string[];
}

export interface FormSubmitStep {
  type: "submit";
  /** CSS selector for the form or submit button */
  selector: string;
  /** Wait for page navigation after submit (default: true) */
  waitForNavigation?: boolean;
}

export interface KeyPressStep {
  type: "keypress";
  /** Key to press (e.g., "Enter", "Tab", "Escape", "ArrowDown") */
  key: string;
  /** Optional modifiers ("Control", "Shift", "Alt", "Meta") */
  modifiers?: string[];
  /** Optional element to focus first */
  selector?: string;
}

export interface FocusStep {
  type: "focus";
  /** CSS selector for the element to focus */
  selector: string;
}

export interface BlurStep {
  type: "blur";
  /** CSS selector for the element to blur */
  selector: string;
}

export interface ClearStep {
  type: "clear";
  /** CSS selector for the input element to clear */
  selector: string;
}

export interface EvaluateStep {
  type: "evaluate";
  /** JavaScript code to execute */
  script: string;
  /** Optional selector to pass element to the script */
  selector?: string;
}

/**
 * Form field input for the fillForm step.
 * Supports text inputs, selects, checkboxes, radio buttons, and textareas.
 */
export interface FormFieldInput {
  /** CSS selector for the form field */
  selector: string;
  /** Value to set. For checkboxes, use "true" or "false". For radio, use the value attribute. */
  value: string;
  /** Field type hint. Auto-detected if not specified. */
  type?: "text" | "select" | "checkbox" | "radio" | "textarea" | "password" | "email" | "number" | "tel" | "url" | "date" | "file";
  /** For select fields, whether to match by visible text instead of value */
  matchByText?: boolean;
  /** Delay between keystrokes in ms (for text inputs) */
  delay?: number;
}

export interface FillFormStep {
  type: "fillForm";
  /** Array of form fields to fill. Executed in order. */
  fields: FormFieldInput[];
  /** CSS selector for the form container (optional, for scoping) */
  formSelector?: string;
  /** Whether to submit the form after filling (default: false) */
  submit?: boolean;
  /** Selector for the submit button. If not specified, uses form.submit() or looks for submit button */
  submitSelector?: string;
  /** Whether to wait for navigation after submit (default: true) */
  waitForNavigation?: boolean;
}

export interface QuickFillStep {
  type: "quickFill";
  /** CSS selector for the input field */
  target: string;
  /** Value to enter */
  value: string;
  /** Press Enter after typing to submit (default: false) */
  submit?: boolean;
}

export interface ViewportStep {
  type: "viewport";
  /** Device preset name (e.g., 'iphone-14', 'desktop-hd', 'ipad-pro') */
  preset?: string;
  /** Viewport width in pixels. Overrides preset width if specified */
  width?: number;
  /** Viewport height in pixels. Overrides preset height if specified */
  height?: number;
  /** Device scale factor (DPR). Defaults to 1 */
  deviceScaleFactor?: number;
  /** Whether to emulate a mobile device */
  isMobile?: boolean;
  /** Whether the device supports touch events */
  hasTouch?: boolean;
  /** Whether the viewport is in landscape orientation */
  isLandscape?: boolean;
  /** Custom User-Agent string to use */
  userAgent?: string;
}

export interface FullPageStep {
  type: "fullPage";
  /** Enable or disable full page capture for subsequent screenshots */
  enabled: boolean;
}

// ============================================
// NEW SIMPLIFIED STEP TYPES FOR LLM (8 types)
// ============================================

export interface FillStep {
  type: "fill";
  /** CSS selector for single input field (e.g., '#email', '.search-box') */
  target?: string;
  /** Value to enter. For checkboxes: 'true'/'false'. For select: option value or text */
  value?: string;
  /** Multiple fields to fill in sequence */
  fields?: Array<{
    target: string;
    value: string;
  }>;
  /** Submit form after filling. Default: false */
  submit?: boolean;
  /** Clear existing value before typing. Default: true */
  clear?: boolean;
}

export interface SimpleClickStep {
  type: "click";
  /** CSS selector of element to click (e.g., 'button.submit', '#login-btn') */
  target: string;
  /** CSS selector to wait for after clicking (e.g., '.modal', '.results') */
  waitAfter?: string;
}

export interface SimpleScrollStep {
  type: "scroll";
  /** CSS selector to scroll into view (e.g., '#section-2', '.footer') */
  to?: string;
  /** Vertical scroll position in pixels. Ignored if 'to' is specified */
  y?: number;
}

export interface WaitStep {
  type: "wait";
  /** CSS selector to wait for (e.g., '.loaded', '#content') */
  for?: string;
  /** Milliseconds to wait (max 30000). Use if no selector available */
  duration?: number;
}

export interface SimpleScreenshotStep {
  type: "screenshot";
  /** Capture entire scrollable page. Default: false (viewport only) */
  fullPage?: boolean;
  /** CSS selector to capture specific element instead of page */
  element?: string;
}

export interface SimpleViewportStep {
  type: "viewport";
  /** Device preset: 'desktop', 'mobile', 'tablet', 'iphone-14', 'ipad-pro', 'pixel-7' */
  device?: string;
  /** Custom width in pixels. Overrides device preset */
  width?: number;
  /** Custom height in pixels. Overrides device preset */
  height?: number;
}

export interface TypeStep {
  type: "type";
  /** CSS selector for input element */
  target: string;
  /** Text to type character by character */
  text: string;
  /** Press Enter after typing. Default: false */
  pressEnter?: boolean;
  /** Delay between keystrokes in ms. Default: 0 */
  delay?: number;
}

export interface SimpleHoverStep {
  type: "hover";
  /** CSS selector for element to hover */
  target?: string;
  /** Legacy field */
  selector?: string;
  /** How long to hover in ms. Default: 100 */
  duration?: number;
}

/**
 * All available action steps.
 * 
 * NEW SIMPLIFIED (8 types for LLM):
 * - FillStep - Fill form fields (single or multiple)
 * - SimpleClickStep - Click elements
 * - SimpleScrollStep - Scroll the page
 * - WaitStep - Wait for element or duration
 * - SimpleScreenshotStep - Capture screenshots
 * - SimpleViewportStep - Set device/viewport
 * - TypeStep - Type text with keyboard
 * - SimpleHoverStep - Hover over elements
 * 
 * LEGACY/ADVANCED:
 * - FillFormStep - Fill multiple form fields at once
 * - QuickFillStep - Quick single field
 * - ClickStep - Click with advanced options
 * - ScrollStep - Scroll with advanced options
 * - WaitForSelectorStep - Wait for elements
 * - ScreenshotStep - Capture with advanced options
 * - ViewportStep - Set viewport with all options
 * - DelayStep - Wait for duration
 * - TextInputStep, SelectStep, RadioStep, CheckboxStep - Individual form controls
 * - HoverStep, FocusStep, BlurStep, ClearStep - Element interactions
 * - KeyPressStep - Keyboard input
 * - CookieActionStep, StorageActionStep - Browser state
 * - FileUploadStep, FormSubmitStep - Form handling
 * - EvaluateStep - Custom JavaScript
 * - FullPageStep - Toggle full page mode
 */
export type ActionStep = 
  // NEW Simplified steps (8 types)
  | FillStep
  | SimpleClickStep
  | SimpleScrollStep
  | WaitStep
  | SimpleScreenshotStep
  | SimpleViewportStep
  | TypeStep
  | SimpleHoverStep
  // Legacy/Advanced steps
  | FillFormStep
  | QuickFillStep
  | ClickStep 
  | ScrollStep 
  | WaitForSelectorStep 
  | ScreenshotStep 
  | ViewportStep
  | DelayStep 
  | CookieActionStep 
  | StorageActionStep
  | TextInputStep
  | SelectStep
  | RadioStep
  | CheckboxStep
  | HoverStep
  | FileUploadStep
  | FormSubmitStep
  | KeyPressStep
  | FocusStep
  | BlurStep
  | ClearStep
  | EvaluateStep
  | FullPageStep;

export interface CaptureScreenshotInput {
  url: string;
  headers?: Record<string, string>;
  retryPolicy?: RetryConfig;
  storageTarget?: string;
  steps?: ActionStep[];
  // Legacy parameters - will be converted to steps internally
  /** @deprecated Use steps with type 'cookie' instead */
  cookies?: CaptureCookieInput[];
  /** @deprecated Use steps with type 'viewport' instead */
  viewport?: ViewportConfig;
  /** @deprecated Use steps with type 'scroll' instead */
  scroll?: ScrollConfig;
  /** @deprecated Use steps with type 'click' instead */
  clickActions?: ClickAction[];
}

export interface ScreenshotMetadata {
  url: string;
  fullPage: boolean;
  viewportWidth: number;
  viewportHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  scrollX: number;
  scrollY: number;
  bytes: number;
  capturedAt: string;
  viewportPreset?: string;
  retryAttempts?: number;
  storageLocation?: string;
  clickActionsExecuted?: number;
  stepsExecuted?: number;
}

export interface CaptureScreenshotResult {
  metadata: ScreenshotMetadata;
  imageBase64: string;
  mimeType: string;
}
