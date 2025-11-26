import type { Page } from "puppeteer";

import type { CaptureCookieInput } from "../types/screenshot.js";

type PuppeteerCookieParam = Parameters<Page["setCookie"]>[number];

export function normalizeHeadersInput(
  headers?: Record<string, string>,
): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }

  const normalized = Object.fromEntries(
    Object.entries(headers)
      .map(([key, value]) => [key.trim(), value.trim()])
      .filter(([key, value]) => key.length > 0 && value.length > 0),
  );

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function sanitizeCookieInputs(
  cookies?: CaptureCookieInput[],
): CaptureCookieInput[] | undefined {
  if (!cookies) {
    return undefined;
  }

  const sanitized = cookies
    .map((cookie) => ({
      ...cookie,
      name: cookie.name.trim(),
      value: cookie.value,
    }))
    .filter((cookie) => cookie.name.length > 0 && cookie.value.length > 0);

  return sanitized.length > 0 ? sanitized : undefined;
}

export function toPuppeteerCookies(
  cookies: CaptureCookieInput[] | undefined,
  fallbackUrl: string,
): PuppeteerCookieParam[] {
  const sanitized = sanitizeCookieInputs(cookies);
  if (!sanitized) {
    return [];
  }

  return sanitized.map((cookie) => buildCookieParam(cookie, fallbackUrl));
}

function buildCookieParam(cookie: CaptureCookieInput, fallbackUrl: string): PuppeteerCookieParam {
  const param: PuppeteerCookieParam = {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    expires: cookie.expires,
  };

  if (!param.domain) {
    param.url = cookie.url ?? new URL(fallbackUrl).origin;
  } else if (!param.path) {
    param.path = "/";
  }

  return param;
}
