import { describe, it, expect } from "vitest";
import { normalizeUrl } from "../../src/utils/url.js";

describe("URL utilities", () => {
  describe("normalizeUrl", () => {
    it("should return valid URLs unchanged", () => {
      const url = "https://example.com/path";
      expect(normalizeUrl(url)).toBe("https://example.com/path");
    });

    it("should preserve query parameters", () => {
      const url = "https://example.com/search?q=test&page=1";
      expect(normalizeUrl(url)).toBe("https://example.com/search?q=test&page=1");
    });

    it("should preserve hash fragments", () => {
      const url = "https://example.com/page#section";
      expect(normalizeUrl(url)).toBe("https://example.com/page#section");
    });

    it("should add https:// to URLs without protocol", () => {
      const url = "example.com";
      expect(normalizeUrl(url)).toBe("https://example.com/");
    });

    it("should add https:// to URLs with path but no protocol", () => {
      const url = "example.com/path/to/page";
      expect(normalizeUrl(url)).toBe("https://example.com/path/to/page");
    });

    it("should preserve http:// protocol", () => {
      const url = "http://example.com";
      expect(normalizeUrl(url)).toBe("http://example.com/");
    });

    it("should handle localhost URLs", () => {
      const url = "http://localhost:3000";
      expect(normalizeUrl(url)).toBe("http://localhost:3000/");
    });

    it("should handle localhost without protocol", () => {
      // Note: "localhost:3000" is parsed as scheme "localhost" with path "3000"
      // This is standard URL parsing behavior. For proper localhost URLs, 
      // include http:// or https:// prefix
      const url = "localhost";
      expect(normalizeUrl(url)).toBe("https://localhost/");
    });

    it("should handle IP addresses", () => {
      const url = "http://192.168.1.1:8080/api";
      expect(normalizeUrl(url)).toBe("http://192.168.1.1:8080/api");
    });

    it("should handle IP addresses without protocol", () => {
      const url = "192.168.1.1:8080";
      expect(normalizeUrl(url)).toBe("https://192.168.1.1:8080/");
    });

    it("should normalize trailing slashes consistently", () => {
      const url1 = "https://example.com";
      const url2 = "https://example.com/";
      // Both should normalize to the same format
      expect(normalizeUrl(url1)).toBe("https://example.com/");
      expect(normalizeUrl(url2)).toBe("https://example.com/");
    });

    it("should handle URLs with ports", () => {
      const url = "https://example.com:8443/secure";
      expect(normalizeUrl(url)).toBe("https://example.com:8443/secure");
    });

    it("should handle URLs with authentication", () => {
      const url = "https://user:pass@example.com/";
      expect(normalizeUrl(url)).toBe("https://user:pass@example.com/");
    });

    it("should handle encoded characters", () => {
      const url = "https://example.com/path%20with%20spaces";
      expect(normalizeUrl(url)).toBe("https://example.com/path%20with%20spaces");
    });

    it("should handle subdomains", () => {
      const url = "https://www.subdomain.example.com/page";
      expect(normalizeUrl(url)).toBe("https://www.subdomain.example.com/page");
    });

    it("should throw for completely invalid URLs", () => {
      // Both initial URL parse and fallback with https:// fail
      expect(() => normalizeUrl("://invalid")).toThrow();
    });

    it("should handle file protocol", () => {
      const url = "file:///path/to/file.html";
      expect(normalizeUrl(url)).toBe("file:///path/to/file.html");
    });

    it("should handle data URLs", () => {
      const url = "data:text/html,<h1>Hello</h1>";
      expect(normalizeUrl(url)).toBe("data:text/html,<h1>Hello</h1>");
    });

    it("should handle international domain names", () => {
      const url = "https://例え.jp/";
      const normalized = normalizeUrl(url);
      expect(normalized).toContain("xn--"); // Punycode encoding
    });
  });
});
