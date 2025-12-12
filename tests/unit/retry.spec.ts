import { describe, it, expect, vi, beforeEach } from "vitest";
import { withRetry, DEFAULT_RETRY_POLICY } from "../../src/utils/retry.js";
import type { Logger } from "../../src/logger.js";

describe("retry utilities", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    vi.clearAllMocks();
  });

  describe("withRetry", () => {
    it("should succeed on first attempt", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      
      const result = await withRetry(fn, { logger: mockLogger });
      
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it("should retry on retryable error", async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error("Navigation failed with status: 503"))
        .mockResolvedValueOnce("success");
      
      const result = await withRetry(fn, { 
        logger: mockLogger,
        context: "test",
      });
      
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("attempt_failed"),
        expect.objectContaining({
          attempt: 1,
          willRetry: true,
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("succeeded"),
        expect.objectContaining({
          attempt: 2,
          totalAttempts: 2,
        })
      );
    });

    it("should not retry on non-retryable error", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Invalid URL"));
      
      await expect(withRetry(fn, { 
        logger: mockLogger,
        policy: { maxRetries: 3 },
      })).rejects.toThrow("Invalid URL");
      
      expect(fn).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("failed"),
        expect.objectContaining({
          attempt: 1,
          retryable: false,
        })
      );
    });

    it("should retry with exponential backoff", async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error("ETIMEDOUT"))
        .mockRejectedValueOnce(new Error("ETIMEDOUT"))
        .mockResolvedValueOnce("success");
      
      const startTime = Date.now();
      
      const result = await withRetry(fn, {
        logger: mockLogger,
        policy: {
          maxRetries: 3,
          initialDelayMs: 100,
          backoffMultiplier: 2,
        },
      });
      
      const elapsedTime = Date.now() - startTime;
      
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
      // Should wait ~100ms after first failure, ~200ms after second
      expect(elapsedTime).toBeGreaterThanOrEqual(250);
      expect(elapsedTime).toBeLessThan(400);
    });

    it("should fail after max retries", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Navigation failed with status: 500"));
      
      await expect(withRetry(fn, {
        logger: mockLogger,
        policy: { maxRetries: 2, initialDelayMs: 10 },
      })).rejects.toThrow("Navigation failed with status: 500");
      
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("failed"),
        expect.objectContaining({
          attempt: 3,
          totalAttempts: 3,
        })
      );
    });

    it("should detect retryable DNS errors", async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error("getaddrinfo ENOTFOUND example.com"))
        .mockResolvedValueOnce("success");
      
      const result = await withRetry(fn, {
        logger: mockLogger,
        policy: { initialDelayMs: 10 },
      });
      
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should detect retryable timeout errors", async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error("Request timed out after 30000ms"))
        .mockResolvedValueOnce("success");
      
      const result = await withRetry(fn, {
        logger: mockLogger,
        policy: { initialDelayMs: 10 },
      });
      
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should use custom retryable status codes", async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error("Navigation failed with status: 418"))
        .mockResolvedValueOnce("success");
      
      const result = await withRetry(fn, {
        logger: mockLogger,
        policy: {
          initialDelayMs: 10,
          retryableStatusCodes: [418], // I'm a teapot
        },
      });
      
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should respect maxDelayMs", async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error("ECONNRESET"))
        .mockRejectedValueOnce(new Error("ECONNRESET"))
        .mockRejectedValueOnce(new Error("ECONNRESET"))
        .mockResolvedValueOnce("success");
      
      const startTime = Date.now();
      
      const result = await withRetry(fn, {
        logger: mockLogger,
        policy: {
          maxRetries: 5,
          initialDelayMs: 100,
          maxDelayMs: 150,
          backoffMultiplier: 10, // Would normally result in 1000ms, 10000ms delays
        },
      });
      
      const elapsedTime = Date.now() - startTime;
      
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(4);
      // Should be capped at maxDelayMs (150ms) * 3 retries = ~450ms
      expect(elapsedTime).toBeLessThan(600);
    });
  });

  describe("default retry policy", () => {
    it("should have reasonable defaults", () => {
      expect(DEFAULT_RETRY_POLICY).toEqual({
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        retryableStatusCodes: [500, 502, 503, 504, 408, 429],
        retryableErrors: ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "ECONNREFUSED", "EAI_AGAIN"],
      });
    });
  });
});
