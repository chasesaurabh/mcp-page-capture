import { describe, expect, it, vi } from "vitest";
import { withTimeout, safeBrowserClose, TimeoutError } from "../../src/utils/timeout.js";

describe("timeout utilities", () => {
  describe("TimeoutError", () => {
    it("should create error with message and timeoutMs", () => {
      const error = new TimeoutError("Test timeout", 5000);
      expect(error.message).toBe("Test timeout");
      expect(error.timeoutMs).toBe(5000);
      expect(error.name).toBe("TimeoutError");
    });

    it("should be instanceof Error", () => {
      const error = new TimeoutError("Test", 1000);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TimeoutError);
    });
  });

  describe("withTimeout", () => {
    it("should resolve when promise completes before timeout", async () => {
      const result = await withTimeout(
        Promise.resolve("success"),
        1000,
        "TestOperation"
      );
      expect(result).toBe("success");
    });

    it("should reject with TimeoutError when promise takes too long", async () => {
      const slowPromise = new Promise((resolve) => {
        setTimeout(() => resolve("too late"), 500);
      });

      await expect(withTimeout(slowPromise, 50, "SlowOperation"))
        .rejects.toThrow(TimeoutError);
      
      await expect(withTimeout(slowPromise, 50, "SlowOperation"))
        .rejects.toThrow("SlowOperation timed out after 50ms");
    });

    it("should include timeout duration in error", async () => {
      const slowPromise = new Promise((resolve) => {
        setTimeout(() => resolve("too late"), 500);
      });

      try {
        await withTimeout(slowPromise, 100, "TestOp");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).timeoutMs).toBe(100);
      }
    });

    it("should propagate original error when promise rejects before timeout", async () => {
      const failingPromise = Promise.reject(new Error("Original error"));

      await expect(withTimeout(failingPromise, 1000, "FailingOp"))
        .rejects.toThrow("Original error");
    });

    it("should use default operation name if not provided", async () => {
      const slowPromise = new Promise((resolve) => {
        setTimeout(() => resolve("too late"), 500);
      });

      await expect(withTimeout(slowPromise, 50))
        .rejects.toThrow("Operation timed out after 50ms");
    });

    it("should clear timeout when promise resolves", async () => {
      vi.useFakeTimers();
      
      const promise = Promise.resolve("fast");
      const result = withTimeout(promise, 10000, "FastOp");
      
      await vi.runAllTimersAsync();
      expect(await result).toBe("fast");
      
      vi.useRealTimers();
    });

    it("should clear timeout when promise rejects", async () => {
      vi.useFakeTimers();
      
      // Create the rejected promise and immediately attach a handler to avoid unhandled rejection
      const promise = Promise.reject(new Error("failed"));
      const result = withTimeout(promise, 10000, "FailOp");
      
      // Catch the result to prevent unhandled rejection warning
      result.catch(() => {}); 
      
      await vi.runAllTimersAsync();
      await expect(result).rejects.toThrow("failed");
      
      vi.useRealTimers();
    });
  });

  describe("safeBrowserClose", () => {
    it("should close browser successfully within timeout", async () => {
      const mockBrowser = {
        close: vi.fn().mockResolvedValue(undefined),
      };

      await safeBrowserClose(mockBrowser, 1000);
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it("should log warning when browser close times out", async () => {
      const mockBrowser = {
        close: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
      };
      const mockLogger = {
        warn: vi.fn(),
      };

      await safeBrowserClose(mockBrowser, 50, mockLogger);
      
      expect(mockLogger.warn).toHaveBeenCalledWith("browser:close_timeout", {
        timeoutMs: 50,
        message: "Browser close timed out, process may still be running",
      });
    });

    it("should log warning when browser close throws an error", async () => {
      const mockBrowser = {
        close: vi.fn().mockRejectedValue(new Error("Close failed")),
      };
      const mockLogger = {
        warn: vi.fn(),
      };

      await safeBrowserClose(mockBrowser, 1000, mockLogger);
      
      expect(mockLogger.warn).toHaveBeenCalledWith("browser:close_error", {
        error: "Close failed",
      });
    });

    it("should not throw even when browser close fails", async () => {
      const mockBrowser = {
        close: vi.fn().mockRejectedValue(new Error("Close failed")),
      };

      // Should not throw
      await expect(safeBrowserClose(mockBrowser, 1000)).resolves.toBeUndefined();
    });

    it("should work without logger", async () => {
      const mockBrowser = {
        close: vi.fn().mockImplementation(() => new Promise(() => {})),
      };

      // Should not throw even without logger
      await expect(safeBrowserClose(mockBrowser, 50)).resolves.toBeUndefined();
    });

    it("should use default timeout when not specified", async () => {
      const mockBrowser = {
        close: vi.fn().mockResolvedValue(undefined),
      };

      await safeBrowserClose(mockBrowser);
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });
  });
});
