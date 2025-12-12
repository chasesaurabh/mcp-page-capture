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

export type ActionStep = DelayStep | ClickStep | ScrollStep | WaitForSelectorStep | ScreenshotStep | CookieActionStep | StorageActionStep;

export interface CaptureScreenshotInput {
  url: string;
  fullPage?: boolean;
  headers?: Record<string, string>;
  cookies?: CaptureCookieInput[];
  viewport?: ViewportConfig;
  retryPolicy?: RetryConfig;
  storageTarget?: string;
  scroll?: ScrollConfig;
  clickActions?: ClickAction[];
  steps?: ActionStep[];
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
