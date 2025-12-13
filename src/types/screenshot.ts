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

// Step-based action types
export interface DelayStep {
  type: "delay";
  duration: number;
}

export interface ClickStep {
  type: "click";
  selector: string;
  button?: "left" | "right" | "middle";
  clickCount?: number;
  waitForSelector?: string;
  waitForNavigation?: boolean;
}

export interface ScrollStep {
  type: "scroll";
  x?: number;
  y?: number;
  selector?: string;
  behavior?: "auto" | "smooth";
}

export interface WaitForSelectorStep {
  type: "waitForSelector";
  selector: string;
  timeout?: number;
}

export interface ScreenshotStep {
  type: "screenshot";
  /** Whether to capture the entire scrollable page. If false, captures only the visible viewport. */
  fullPage?: boolean;
  /** CSS selector of a specific element to capture. If provided, only this element is captured. */
  selector?: string;
}

export interface CookieActionStep {
  type: "cookie";
  /** The operation to perform on cookies: 'set' to add/update, 'delete' to remove, 'get' to read a cookie value, 'list' to get all cookies. */
  action: "set" | "delete" | "get" | "list";
  /** Cookie name. Required for 'set', 'delete', and 'get' operations. Not needed for 'list'. */
  name?: string;
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
  /** The operation to perform: 'set' to add/update, 'delete' to remove a key, 'clear' to remove all items, 'get' to read a value, 'list' to get all keys. */
  action: "set" | "delete" | "clear" | "get" | "list";
  /** Storage key. Required for 'set', 'delete', and 'get' operations. */
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

export type ActionStep = 
  | DelayStep 
  | ClickStep 
  | ScrollStep 
  | WaitForSelectorStep 
  | ScreenshotStep 
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
  | ViewportStep
  | FullPageStep;

export interface CaptureScreenshotInput {
  url: string;
  headers?: Record<string, string>;
  retryPolicy?: RetryConfig;
  storageTarget?: string;
  steps?: ActionStep[];
  // Legacy parameters - will be converted to steps internally
  /** @deprecated Use steps with type 'fullPage' instead */
  fullPage?: boolean;
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
