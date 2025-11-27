import { vi } from "vitest";

type EvaluateResult = unknown | ((pageFunction: (...args: any[]) => unknown, params: any) => unknown);
type GotoResult = { ok: () => boolean; status: () => number };
type GotoImplementation = (url: string, options: Record<string, unknown>) => Promise<GotoResult>;

const evaluateQueue: EvaluateResult[] = [];

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
  evaluateQueue.length = 0;
  screenshotBuffer = Buffer.from("mock-image");
  setGotoSuccess();
}

export { launchMock, mockBrowser, mockPage };
