import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger, type LogLevel } from "../../src/logger.js";

describe("logger", () => {
  let stderrWriteSpy: ReturnType<typeof vi.spyOn>;
  let originalEnv: string | undefined;

  beforeEach(() => {
    stderrWriteSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    originalEnv = process.env.LOG_LEVEL;
  });

  afterEach(() => {
    stderrWriteSpy.mockRestore();
    if (originalEnv !== undefined) {
      process.env.LOG_LEVEL = originalEnv;
    } else {
      delete process.env.LOG_LEVEL;
    }
  });

  describe("createLogger", () => {
    it("should create a logger with all log methods", () => {
      const logger = createLogger("info");
      
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
    });

    it("should default to info level when no level specified", () => {
      delete process.env.LOG_LEVEL;
      const logger = createLogger();
      
      logger.debug("debug message");
      logger.info("info message");
      
      // debug should not be logged at info level
      expect(stderrWriteSpy).toHaveBeenCalledTimes(1);
      expect(stderrWriteSpy.mock.calls[0][0]).toContain("info message");
    });

    it("should use LOG_LEVEL environment variable as default", () => {
      process.env.LOG_LEVEL = "debug";
      const logger = createLogger();
      
      logger.debug("debug message");
      
      expect(stderrWriteSpy).toHaveBeenCalledTimes(1);
      expect(stderrWriteSpy.mock.calls[0][0]).toContain("debug message");
    });
  });

  describe("log level filtering", () => {
    it("should log all levels when threshold is debug", () => {
      const logger = createLogger("debug");
      
      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");
      
      expect(stderrWriteSpy).toHaveBeenCalledTimes(4);
    });

    it("should filter debug when threshold is info", () => {
      const logger = createLogger("info");
      
      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");
      
      expect(stderrWriteSpy).toHaveBeenCalledTimes(3);
    });

    it("should filter debug and info when threshold is warn", () => {
      const logger = createLogger("warn");
      
      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");
      
      expect(stderrWriteSpy).toHaveBeenCalledTimes(2);
    });

    it("should only log errors when threshold is error", () => {
      const logger = createLogger("error");
      
      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");
      
      expect(stderrWriteSpy).toHaveBeenCalledTimes(1);
      expect(stderrWriteSpy.mock.calls[0][0]).toContain("error");
    });
  });

  describe("log output format", () => {
    it("should output JSON format", () => {
      const logger = createLogger("info");
      
      logger.info("test message");
      
      const output = stderrWriteSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output.trim());
      
      expect(parsed.message).toBe("test message");
      expect(parsed.level).toBe("info");
    });

    it("should include timestamp in ISO format", () => {
      const logger = createLogger("info");
      
      logger.info("test message");
      
      const output = stderrWriteSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output.trim());
      
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("should include metadata when provided", () => {
      const logger = createLogger("info");
      
      logger.info("test message", { userId: 123, action: "login" });
      
      const output = stderrWriteSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output.trim());
      
      expect(parsed.userId).toBe(123);
      expect(parsed.action).toBe("login");
    });

    it("should output with newline", () => {
      const logger = createLogger("info");
      
      logger.info("test message");
      
      const output = stderrWriteSpy.mock.calls[0][0] as string;
      expect(output.endsWith("\n")).toBe(true);
    });

    it("should set correct level for each log method", () => {
      const logger = createLogger("debug");
      
      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");
      
      const levels = stderrWriteSpy.mock.calls.map((call: [string]) => {
        const parsed = JSON.parse(call[0].trim());
        return parsed.level;
      });
      
      expect(levels).toEqual(["debug", "info", "warn", "error"]);
    });
  });

  describe("edge cases", () => {
    it("should handle empty metadata object", () => {
      const logger = createLogger("info");
      
      logger.info("test message", {});
      
      const output = stderrWriteSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output.trim());
      
      expect(parsed.message).toBe("test message");
    });

    it("should handle special characters in message", () => {
      const logger = createLogger("info");
      
      logger.info('Message with "quotes" and \n newlines');
      
      const output = stderrWriteSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output.trim());
      
      expect(parsed.message).toBe('Message with "quotes" and \n newlines');
    });

    it("should handle nested metadata objects", () => {
      const logger = createLogger("info");
      
      logger.info("test", { 
        nested: { 
          deep: { value: 42 } 
        } 
      });
      
      const output = stderrWriteSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output.trim());
      
      expect(parsed.nested.deep.value).toBe(42);
    });

    it("should handle array values in metadata", () => {
      const logger = createLogger("info");
      
      logger.info("test", { items: [1, 2, 3] });
      
      const output = stderrWriteSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output.trim());
      
      expect(parsed.items).toEqual([1, 2, 3]);
    });
  });
});
