import { describe, it, expect } from "vitest";
import { createLLMError, formatErrorForMCP, ERROR_CODES } from "../../src/utils/errors.js";

describe("Error Handling", () => {
  describe("createLLMError", () => {
    it("should create ELEMENT_NOT_FOUND error", () => {
      const error = createLLMError("ELEMENT_NOT_FOUND", {
        message: "Element not found",
        step: 2,
        stepType: "click",
        target: "#missing-button",
        url: "https://example.com",
        stepsTotal: 5,
        stepsCompleted: 2,
        lastSuccessfulStep: 1,
        executionTimeMs: 1000
      });

      expect(error.success).toBe(false);
      expect(error.error.code).toBe(ERROR_CODES.ELEMENT_NOT_FOUND);
      expect(error.error.step).toBe(2);
      expect(error.error.stepType).toBe("click");
      expect(error.error.target).toBe("#missing-button");
      expect(error.recovery.description).toContain("not found");
      expect(error.recovery.correctedSteps).toBeDefined();
      expect(error.context).toBeDefined();
      expect(error.context.url).toBe("https://example.com");
      expect(error.context.stepsTotal).toBe(5);
      expect(error.context.stepsCompleted).toBe(2);
      expect(error.context.lastSuccessfulStep).toBe(1);
    });

    it("should create ELEMENT_NOT_VISIBLE error", () => {
      const error = createLLMError("ELEMENT_NOT_VISIBLE", {
        message: "Element not visible",
        step: 1,
        stepType: "click",
        target: ".hidden-element"
      });

      expect(error.error.code).toBe(ERROR_CODES.ELEMENT_NOT_VISIBLE);
      expect(error.recovery.description).toContain("not visible");
      expect(error.recovery.correctedSteps).toBeDefined();
      expect(Array.isArray(error.recovery.correctedSteps)).toBe(true);
    });

    it("should create ELEMENT_NOT_CLICKABLE error", () => {
      const error = createLLMError("ELEMENT_NOT_CLICKABLE", {
        message: "Element not clickable",
        step: 1,
        stepType: "click",
        target: ".covered-button"
      });

      expect(error.error.code).toBe(ERROR_CODES.ELEMENT_NOT_CLICKABLE);
      expect(error.recovery.description).toContain("covered");
      expect(error.recovery.correctedSteps).toBeDefined();
    });

    it("should create NAVIGATION_TIMEOUT error", () => {
      const error = createLLMError("NAVIGATION_TIMEOUT", {
        message: "Navigation timeout",
        url: "https://slow-site.com"
      });

      expect(error.error.code).toBe(ERROR_CODES.NAVIGATION_TIMEOUT);
      expect(error.recovery.description).toContain("slow");
      expect(error.context.url).toBe("https://slow-site.com");
    });

    it("should create INVALID_SELECTOR error", () => {
      const error = createLLMError("INVALID_SELECTOR", {
        message: "Invalid selector",
        target: "##invalid"
      });

      expect(error.error.code).toBe(ERROR_CODES.INVALID_SELECTOR);
      expect(error.recovery.description).toContain("selector");
      expect(error.recovery.correctedSteps).toBeUndefined();
    });

    it("should create FILL_FAILED error", () => {
      const error = createLLMError("FILL_FAILED", {
        message: "Fill failed",
        step: 0,
        stepType: "fill",
        target: "#disabled-input"
      });

      expect(error.error.code).toBe(ERROR_CODES.FILL_FAILED);
      expect(error.recovery.description).toContain("Could not fill");
      expect(error.recovery.correctedSteps).toBeDefined();
    });

    it("should include context with defaults if url is not provided", () => {
      const error = createLLMError("ELEMENT_NOT_FOUND", {
        message: "Element not found",
        target: "#missing"
      });

      expect(error.context).toBeDefined();
      expect(error.context.url).toBe("");
      expect(error.context.stepsTotal).toBe(0);
      expect(error.context.stepsCompleted).toBe(0);
    });
  });

  describe("formatErrorForMCP", () => {
    it("should format error with all fields", () => {
      const error = createLLMError("ELEMENT_NOT_FOUND", {
        message: "Element not found",
        step: 1,
        stepType: "click",
        target: "#button",
        url: "https://example.com",
        stepsTotal: 3,
        stepsCompleted: 1,
        lastSuccessfulStep: 0,
        executionTimeMs: 500
      });

      const formatted = formatErrorForMCP(error);
      
      expect(formatted).toContain("❌");
      expect(formatted).toContain(ERROR_CODES.ELEMENT_NOT_FOUND);
      expect(formatted).toContain("RECOVERY:");
      expect(formatted).toContain("CORRECTED STEPS:");
      expect(formatted).toContain("```json");
      expect(formatted).toContain("Context:");
      expect(formatted).toContain("1/3 steps completed");
      expect(formatted).toContain("last success: step 0");
    });

    it("should format error without context", () => {
      const error = createLLMError("INVALID_SELECTOR", {
        message: "Invalid selector",
        target: "##bad"
      });

      const formatted = formatErrorForMCP(error);
      
      expect(formatted).toContain("❌");
      expect(formatted).toContain(ERROR_CODES.INVALID_SELECTOR);
      expect(formatted).toContain("RECOVERY:");
      expect(formatted).toContain("Context:");
    });

    it("should include JSON example in formatted output", () => {
      const error = createLLMError("ELEMENT_NOT_VISIBLE", {
        message: "Not visible",
        step: 1,
        stepType: "click",
        target: ".element"
      });

      const formatted = formatErrorForMCP(error);
      
      expect(formatted).toContain("```json");
      expect(formatted).toContain('"type"');
    });
  });

  describe("Error Codes", () => {
    it("should have all required error codes", () => {
      expect(ERROR_CODES.ELEMENT_NOT_FOUND).toBe("ELEMENT_NOT_FOUND");
      expect(ERROR_CODES.ELEMENT_NOT_VISIBLE).toBe("ELEMENT_NOT_VISIBLE");
      expect(ERROR_CODES.ELEMENT_NOT_CLICKABLE).toBe("ELEMENT_NOT_CLICKABLE");
      expect(ERROR_CODES.NAVIGATION_TIMEOUT).toBe("NAVIGATION_TIMEOUT");
      expect(ERROR_CODES.NAVIGATION_FAILED).toBe("NAVIGATION_FAILED");
      expect(ERROR_CODES.INVALID_SELECTOR).toBe("INVALID_SELECTOR");
      expect(ERROR_CODES.INVALID_URL).toBe("INVALID_URL");
      expect(ERROR_CODES.STEP_TIMEOUT).toBe("STEP_TIMEOUT");
      expect(ERROR_CODES.FILL_FAILED).toBe("FILL_FAILED");
      expect(ERROR_CODES.SCROLL_FAILED).toBe("SCROLL_FAILED");
    });
  });

  describe("Error Fix Examples", () => {
    it("should provide wait step example for ELEMENT_NOT_FOUND", () => {
      const error = createLLMError("ELEMENT_NOT_FOUND", {
        message: "Not found",
        stepType: "click",
        target: "#button"
      });

      expect(error.recovery.correctedSteps).toBeDefined();
      expect(Array.isArray(error.recovery.correctedSteps)).toBe(true);
      if (error.recovery.correctedSteps) {
        expect(error.recovery.correctedSteps.length).toBeGreaterThan(0);
      }
    });

    it("should provide scroll and wait example for ELEMENT_NOT_VISIBLE", () => {
      const error = createLLMError("ELEMENT_NOT_VISIBLE", {
        message: "Not visible",
        stepType: "fill",
        target: "#input"
      });

      expect(error.recovery.correctedSteps).toBeDefined();
      expect(Array.isArray(error.recovery.correctedSteps)).toBe(true);
      if (error.recovery.correctedSteps) {
        expect(error.recovery.correctedSteps.length).toBeGreaterThan(0);
      }
    });

    it("should provide valid selector examples for INVALID_SELECTOR", () => {
      const error = createLLMError("INVALID_SELECTOR", {
        message: "Invalid",
        target: "bad"
      });

      expect(error.recovery.correctedSteps).toBeUndefined();
      expect(error.recovery.description).toContain("selector");
    });
  });
});
