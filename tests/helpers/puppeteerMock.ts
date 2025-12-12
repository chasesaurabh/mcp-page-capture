import { vi } from "vitest";

type EvaluateResult = unknown | ((pageFunction: (...args: any[]) => unknown, params: any) => unknown);
type GotoResult = { ok: () => boolean; status: () => number };
type GotoImplementation = (url: string, options: Record<string, unknown>) => Promise<GotoResult>;

const evaluateQueue: EvaluateResult[] = [];

let waitForSelectorImpl: (selector: string, options?: any) => Promise<any> = async () => ({});
let clickImpl: (selector: string, options?: any) => Promise<void> = async () => undefined;
let waitForNavigationImpl: (options?: any) => Promise<any> = async () => ({});
let cookiesImpl: () => Promise<any[]> = async () => [];
let deleteCookieImpl: (cookie: any) => Promise<void> = async () => undefined;
let elementSelectorImpl: (selector: string) => Promise<any> = async (selector: string) => ({
  screenshot: vi.fn(async () => screenshotBuffer),
});

const mockPage = {
  setViewport: vi.fn(async () => undefined),
  setDefaultNavigationTimeout: vi.fn(async () => undefined),
  setExtraHTTPHeaders: vi.fn(async () => undefined),
  setCookie: vi.fn(async (..._cookies: any[]) => undefined),
  goto: vi.fn(async (url: string, options: Record<string, unknown>) => gotoImpl(url, options)),
  screenshot: vi.fn(async () => screenshotBuffer),
  evaluate: vi.fn(async (pageFunction: (...args: any[]) => unknown, params: any) => {
    if (evaluateQueue.length === 0) {
      throw new Error("No queued evaluate result.");
    }
    const next = evaluateQueue.shift()!;
    return typeof next === "function" ? next(pageFunction, params) : next;
  }),
  click: vi.fn(async (selector: string, options?: any) => clickImpl(selector, options)),
  waitForSelector: vi.fn(async (selector: string, options?: any) => waitForSelectorImpl(selector, options)),
  waitForNavigation: vi.fn(async (options?: any) => waitForNavigationImpl(options)),
  setUserAgent: vi.fn(async () => undefined),
  evaluateOnNewDocument: vi.fn(async () => undefined),
  cookies: vi.fn(async () => cookiesImpl()),
  deleteCookie: vi.fn(async (cookie: any) => deleteCookieImpl(cookie)),
  $: vi.fn(async (selector: string) => elementSelectorImpl(selector)),
};

const mockBrowser = {
  newPage: vi.fn(async () => mockPage),
  close: vi.fn(async () => undefined),
};

const launchMock = vi.fn(async () => mockBrowser);

let screenshotBuffer: Buffer = Buffer.from("mock-image");
let gotoImpl: GotoImplementation = async () => ({
  ok: () => true,
  status: () => 200,
});

vi.mock("puppeteer", () => ({
  default: { launch: launchMock },
}));

export function queueEvaluateResult(...results: EvaluateResult[]) {
  evaluateQueue.push(...results);
}

export function setEvaluateResults(...results: EvaluateResult[]) {
  evaluateQueue.length = 0;
  queueEvaluateResult(...results);
}

export function setScreenshotBuffer(buffer: Buffer) {
  screenshotBuffer = buffer;
}

export function setGotoImplementation(implementation: GotoImplementation) {
  gotoImpl = implementation;
}

export function setGotoSuccess(status = 200) {
  setGotoImplementation(async () => ({
    ok: () => true,
    status: () => status,
  }));
}

export function setGotoFailure(status = 500) {
  setGotoImplementation(async () => ({
    ok: () => false,
    status: () => status,
  }));
}

export function setWaitForSelectorImpl(impl: (selector: string, options?: any) => Promise<any>) {
  waitForSelectorImpl = impl;
}

export function setClickImpl(impl: (selector: string, options?: any) => Promise<void>) {
  clickImpl = impl;
}

export function setWaitForNavigationImpl(impl: (options?: any) => Promise<any>) {
  waitForNavigationImpl = impl;
}

export function setCookiesImpl(impl: () => Promise<any[]>) {
  cookiesImpl = impl;
}

export function setDeleteCookieImpl(impl: (cookie: any) => Promise<void>) {
  deleteCookieImpl = impl;
}

export function setElementSelectorImpl(impl: (selector: string) => Promise<any>) {
  elementSelectorImpl = impl;
}

export function setElementSelectorNotFound(selector: string) {
  elementSelectorImpl = async (sel: string) => {
    if (sel === selector) {
      return null;
    }
    return {
      screenshot: vi.fn(async () => screenshotBuffer),
    };
  };
}

export function setWaitForSelectorFailure(selector: string) {
  waitForSelectorImpl = async (sel: string) => {
    if (sel === selector) {
      throw new Error(`Waiting for selector \`${selector}\` failed: timeout`);
    }
    return {};
  };
}

export function resetPuppeteerMock() {
  launchMock.mockClear();
  mockBrowser.newPage.mockClear();
  mockBrowser.close.mockClear();
  mockPage.setViewport.mockClear();
  mockPage.setDefaultNavigationTimeout.mockClear();
  mockPage.setExtraHTTPHeaders.mockClear();
  mockPage.setCookie.mockClear();
  mockPage.goto.mockClear();
  mockPage.screenshot.mockClear();
  mockPage.evaluate.mockClear();
  mockPage.click.mockClear();
  mockPage.waitForSelector.mockClear();
  mockPage.waitForNavigation.mockClear();
  mockPage.setUserAgent.mockClear();
  mockPage.evaluateOnNewDocument.mockClear();
  mockPage.cookies.mockClear();
  mockPage.deleteCookie.mockClear();
  mockPage.$.mockClear();
  evaluateQueue.length = 0;
  screenshotBuffer = Buffer.from("mock-image");
  setGotoSuccess();
  waitForSelectorImpl = async () => ({});
  clickImpl = async () => undefined;
  waitForNavigationImpl = async () => ({});
  cookiesImpl = async () => [];
  deleteCookieImpl = async () => undefined;
  elementSelectorImpl = async (selector: string) => ({
    screenshot: vi.fn(async () => screenshotBuffer),
  });
}

export { launchMock, mockBrowser, mockPage };
