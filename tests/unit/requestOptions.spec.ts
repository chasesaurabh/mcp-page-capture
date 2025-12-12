import { describe, it, expect } from "vitest";
import { 
  normalizeHeadersInput, 
  sanitizeCookieInputs, 
  toPuppeteerCookies 
} from "../../src/utils/requestOptions.js";
import type { CaptureCookieInput } from "../../src/types/screenshot.js";

describe("request options utilities", () => {
  describe("normalizeHeadersInput", () => {
    it("should return undefined for undefined input", () => {
      expect(normalizeHeadersInput(undefined)).toBeUndefined();
    });

    it("should return undefined for empty headers object", () => {
      expect(normalizeHeadersInput({})).toBeUndefined();
    });

    it("should trim whitespace from header keys and values", () => {
      const headers = {
        "  Content-Type  ": "  application/json  ",
        " Authorization ": " Bearer token ",
      };
      
      const result = normalizeHeadersInput(headers);
      
      expect(result).toEqual({
        "Content-Type": "application/json",
        "Authorization": "Bearer token",
      });
    });

    it("should filter out headers with empty keys after trimming", () => {
      const headers = {
        "  ": "value",
        "Valid-Header": "value",
      };
      
      const result = normalizeHeadersInput(headers);
      
      expect(result).toEqual({
        "Valid-Header": "value",
      });
    });

    it("should filter out headers with empty values after trimming", () => {
      const headers = {
        "Empty-Value": "   ",
        "Valid-Header": "value",
      };
      
      const result = normalizeHeadersInput(headers);
      
      expect(result).toEqual({
        "Valid-Header": "value",
      });
    });

    it("should return undefined if all headers are invalid", () => {
      const headers = {
        "  ": "value",
        "Header": "   ",
      };
      
      expect(normalizeHeadersInput(headers)).toBeUndefined();
    });

    it("should preserve valid headers without modification", () => {
      const headers = {
        "X-Custom-Header": "custom-value",
        "Accept": "text/html",
      };
      
      const result = normalizeHeadersInput(headers);
      
      expect(result).toEqual(headers);
    });

    it("should handle single header", () => {
      const headers = { "Authorization": "Bearer xyz" };
      
      const result = normalizeHeadersInput(headers);
      
      expect(result).toEqual({ "Authorization": "Bearer xyz" });
    });
  });

  describe("sanitizeCookieInputs", () => {
    it("should return undefined for undefined input", () => {
      expect(sanitizeCookieInputs(undefined)).toBeUndefined();
    });

    it("should return undefined for empty array", () => {
      expect(sanitizeCookieInputs([])).toBeUndefined();
    });

    it("should trim cookie names", () => {
      const cookies: CaptureCookieInput[] = [
        { name: "  session  ", value: "abc123" },
      ];
      
      const result = sanitizeCookieInputs(cookies);
      
      expect(result?.[0].name).toBe("session");
    });

    it("should preserve cookie values as-is", () => {
      const cookies: CaptureCookieInput[] = [
        { name: "token", value: "  value with spaces  " },
      ];
      
      const result = sanitizeCookieInputs(cookies);
      
      expect(result?.[0].value).toBe("  value with spaces  ");
    });

    it("should filter out cookies with empty names after trimming", () => {
      const cookies: CaptureCookieInput[] = [
        { name: "  ", value: "value" },
        { name: "valid", value: "value" },
      ];
      
      const result = sanitizeCookieInputs(cookies);
      
      expect(result).toHaveLength(1);
      expect(result?.[0].name).toBe("valid");
    });

    it("should filter out cookies with empty values", () => {
      const cookies: CaptureCookieInput[] = [
        { name: "empty", value: "" },
        { name: "valid", value: "value" },
      ];
      
      const result = sanitizeCookieInputs(cookies);
      
      expect(result).toHaveLength(1);
      expect(result?.[0].name).toBe("valid");
    });

    it("should return undefined if all cookies are invalid", () => {
      const cookies: CaptureCookieInput[] = [
        { name: "  ", value: "value" },
        { name: "cookie", value: "" },
      ];
      
      expect(sanitizeCookieInputs(cookies)).toBeUndefined();
    });

    it("should preserve all cookie properties", () => {
      const cookies: CaptureCookieInput[] = [
        {
          name: "session",
          value: "abc",
          domain: "example.com",
          path: "/app",
          secure: true,
          httpOnly: true,
          sameSite: "Strict",
          expires: 1234567890,
        },
      ];
      
      const result = sanitizeCookieInputs(cookies);
      
      expect(result?.[0]).toEqual({
        name: "session",
        value: "abc",
        domain: "example.com",
        path: "/app",
        secure: true,
        httpOnly: true,
        sameSite: "Strict",
        expires: 1234567890,
      });
    });
  });

  describe("toPuppeteerCookies", () => {
    const fallbackUrl = "https://example.com/page";

    it("should return empty array for undefined cookies", () => {
      expect(toPuppeteerCookies(undefined, fallbackUrl)).toEqual([]);
    });

    it("should return empty array for empty cookies array", () => {
      expect(toPuppeteerCookies([], fallbackUrl)).toEqual([]);
    });

    it("should use fallback URL origin when no domain specified", () => {
      const cookies: CaptureCookieInput[] = [
        { name: "session", value: "abc" },
      ];
      
      const result = toPuppeteerCookies(cookies, fallbackUrl);
      
      expect(result[0].url).toBe("https://example.com");
      expect(result[0].domain).toBeUndefined();
    });

    it("should use cookie URL when specified", () => {
      const cookies: CaptureCookieInput[] = [
        { name: "session", value: "abc", url: "https://other.com" },
      ];
      
      const result = toPuppeteerCookies(cookies, fallbackUrl);
      
      // Cookie URL is used as-is (normalization happens at schema level, not here)
      expect(result[0].url).toBe("https://other.com");
    });

    it("should set default path when domain is specified without path", () => {
      const cookies: CaptureCookieInput[] = [
        { name: "session", value: "abc", domain: "example.com" },
      ];
      
      const result = toPuppeteerCookies(cookies, fallbackUrl);
      
      expect(result[0].domain).toBe("example.com");
      expect(result[0].path).toBe("/");
    });

    it("should preserve path when both domain and path are specified", () => {
      const cookies: CaptureCookieInput[] = [
        { name: "session", value: "abc", domain: "example.com", path: "/app" },
      ];
      
      const result = toPuppeteerCookies(cookies, fallbackUrl);
      
      expect(result[0].domain).toBe("example.com");
      expect(result[0].path).toBe("/app");
    });

    it("should preserve all cookie attributes", () => {
      const cookies: CaptureCookieInput[] = [
        {
          name: "secure-cookie",
          value: "secret",
          domain: "example.com",
          path: "/secure",
          secure: true,
          httpOnly: true,
          sameSite: "None",
          expires: 9999999999,
        },
      ];
      
      const result = toPuppeteerCookies(cookies, fallbackUrl);
      
      expect(result[0]).toMatchObject({
        name: "secure-cookie",
        value: "secret",
        domain: "example.com",
        path: "/secure",
        secure: true,
        httpOnly: true,
        sameSite: "None",
        expires: 9999999999,
      });
    });

    it("should handle multiple cookies", () => {
      const cookies: CaptureCookieInput[] = [
        { name: "cookie1", value: "value1" },
        { name: "cookie2", value: "value2", domain: "other.com" },
      ];
      
      const result = toPuppeteerCookies(cookies, fallbackUrl);
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("cookie1");
      expect(result[1].name).toBe("cookie2");
    });

    it("should filter out invalid cookies via sanitization", () => {
      const cookies: CaptureCookieInput[] = [
        { name: "  ", value: "invalid" },
        { name: "valid", value: "value" },
      ];
      
      const result = toPuppeteerCookies(cookies, fallbackUrl);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("valid");
    });

    it("should handle sameSite Lax value", () => {
      const cookies: CaptureCookieInput[] = [
        { name: "lax-cookie", value: "value", sameSite: "Lax" },
      ];
      
      const result = toPuppeteerCookies(cookies, fallbackUrl);
      
      expect(result[0].sameSite).toBe("Lax");
    });

    it("should handle sameSite Strict value", () => {
      const cookies: CaptureCookieInput[] = [
        { name: "strict-cookie", value: "value", sameSite: "Strict" },
      ];
      
      const result = toPuppeteerCookies(cookies, fallbackUrl);
      
      expect(result[0].sameSite).toBe("Strict");
    });
  });
});
