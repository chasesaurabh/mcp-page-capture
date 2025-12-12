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
}

export type ActionStep = DelayStep | ClickStep | ScrollStep | WaitForSelectorStep | ScreenshotStep;

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
