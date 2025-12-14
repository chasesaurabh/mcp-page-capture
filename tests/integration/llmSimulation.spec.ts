import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { normalizeAllSteps } from "../../src/utils/parameterNormalization.js";
import { preValidateSteps } from "../../src/utils/preValidation.js";
import { primaryStepSchema } from "../../src/schemas/steps.js";

describe("LLM Simulation Tests", () => {
  describe("Common LLM Mistakes", () => {
    it("should handle viewport not first", () => {
      const steps = [
        { type: "click", target: "button" },
        { type: "viewport", device: "mobile" },
      ];
      
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.valid).toBe(true);
      expect(result.corrections.length).toBeGreaterThan(0);
      expect(result.corrections[0].reason).toContain("viewport must be first");
      expect(result.correctedSteps![0].type).toBe("viewport");
    });

    it("should handle legacy parameter names", () => {
      const steps = [
        { type: "waitForSelector", awaitElement: ".content" },
        { type: "click", selector: "button" },
      ];
      
      const normalized = normalizeAllSteps(steps);
      
      expect(normalized[0].type).toBe("wait");
      expect(normalized[0].for).toBe(".content");
      expect(normalized[1].target).toBe("button");
      expect(normalized[1].selector).toBeUndefined();
    });

    it("should normalize multiple legacy parameters in one step", () => {
      const steps = [
        { type: "click", selector: "button", waitForSelector: ".result" },
      ];
      
      const normalized = normalizeAllSteps(steps);
      
      expect(normalized[0].target).toBe("button");
      expect(normalized[0].wait).toBe(".result");
      expect(normalized[0].selector).toBeUndefined();
      expect(normalized[0].waitForSelector).toBeUndefined();
    });

    it("should handle mixed legacy and canonical parameters", () => {
      const steps = [
        { type: "scroll", scrollTo: "#footer" },
        { type: "screenshot", captureElement: ".hero" },
      ];
      
      const normalized = normalizeAllSteps(steps);
      
      expect(normalized[0].to).toBe("#footer");
      expect(normalized[1].element).toBe(".hero");
    });
  });

  describe("Parameter Variations", () => {
    const deviceVariations = [
      { input: "mobile", expected: "mobile" },
      { input: "iphone-14", expected: "iphone-14" },
      { input: "desktop", expected: "desktop" },
    ];

    deviceVariations.forEach(({ input, expected }) => {
      it(`should accept device name: "${input}"`, () => {
        const step = { type: "viewport", device: input };
        const result = primaryStepSchema.safeParse(step);
        expect(result.success).toBe(true);
        if (result.success && result.data.type === "viewport") {
          expect(result.data.device).toBe(expected);
        }
      });
    });

    it("should handle various selector formats", () => {
      const selectors = [
        "#id",
        ".class",
        "button",
        "[data-test='value']",
        ".parent .child",
        "div > p",
        "input[type='text']",
      ];

      selectors.forEach(selector => {
        const step = { type: "click", target: selector };
        const result = primaryStepSchema.safeParse(step);
        expect(result.success).toBe(true);
      });
    });
  });

  describe("Step Order Validation", () => {
    it("should warn about missing wait before dynamic actions", () => {
      const steps = [
        { type: "fill", target: ".dynamic-input", value: "test" },
      ];
      
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("wait");
    });

    it("should not warn when wait is present", () => {
      const steps = [
        { type: "wait", for: ".dynamic-input" },
        { type: "fill", target: ".dynamic-input", value: "test" },
      ];
      
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.warnings).toHaveLength(0);
    });

    it("should warn about steps after screenshot", () => {
      const steps = [
        { type: "screenshot" },
        { type: "click", target: "button" },
      ];
      
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("after screenshot");
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle login flow with normalization", () => {
      const steps = [
        { type: "waitForSelector", awaitElement: "#email" },
        { type: "fill", target: "#email", value: "user@example.com" },
        { type: "fill", target: "#password", value: "secret" },
        { type: "click", selector: "button[type=submit]", waitAfter: ".dashboard" },
      ];
      
      const normalized = normalizeAllSteps(steps);
      
      expect(normalized[0].type).toBe("wait");
      expect(normalized[0].for).toBe("#email");
      expect(normalized[3].target).toBe("button[type=submit]");
      expect(normalized[3].wait).toBe(".dashboard");
    });

    it("should handle search form with submit", () => {
      const steps = [
        { type: "viewport", device: "mobile" },
        { type: "wait", for: "#search" },
        { type: "fill", target: "#search", value: "MCP protocol", submit: true },
        { type: "wait", for: ".results" },
      ];
      
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle full page screenshot with scroll", () => {
      const steps = [
        { type: "wait", for: ".content" },
        { type: "scroll", to: "#footer" },
        { type: "screenshot", fullPage: true },
      ];
      
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.valid).toBe(true);
      expect(result.canProceed).toBe(true);
    });

    it("should handle mobile viewport with interactions", () => {
      const steps = [
        { type: "viewport", device: "iphone-14" },
        { type: "wait", for: ".mobile-menu" },
        { type: "click", target: ".mobile-menu", wait: ".menu-open" },
        { type: "click", target: ".menu-item" },
      ];
      
      const normalized = normalizeAllSteps(steps);
      const result = preValidateSteps(normalized, "https://example.com");
      
      expect(result.valid).toBe(true);
      expect(normalized[0].type).toBe("viewport");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty steps array", () => {
      const steps: any[] = [];
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.valid).toBe(true);
      expect(result.canProceed).toBe(true);
    });

    it("should handle steps with optional parameters omitted", () => {
      const steps = [
        { type: "viewport", device: "mobile" },
        { type: "wait", for: ".content" },
        { type: "click", target: "button" },
        { type: "screenshot" },
      ];
      
      steps.forEach(step => {
        const result = primaryStepSchema.safeParse(step);
        expect(result.success).toBe(true);
      });
    });

    it("should handle whitespace in selectors", () => {
      const steps = [
        { type: "click", target: "  button  " },
        { type: "wait", for: "  .content  " },
      ];
      
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.corrections.length).toBeGreaterThan(0);
      expect(result.corrections.every(c => c.reason.includes("whitespace"))).toBe(true);
    });

    it("should reject invalid step types", () => {
      const step = { type: "invalid-type", target: "button" };
      const result = primaryStepSchema.safeParse(step);
      
      expect(result.success).toBe(false);
    });

    it("should reject steps with missing required parameters", () => {
      const steps = [
        { type: "fill", value: "test" }, // missing target
        { type: "click" }, // missing target
        // Note: wait step now accepts either 'for' OR 'duration', so empty wait is valid at schema level
        // but will fail at validation level (performStepValidation)
      ];
      
      steps.forEach(step => {
        const result = primaryStepSchema.safeParse(step);
        expect(result.success).toBe(false);
      });
    });

    it("should accept wait step with duration instead of selector", () => {
      const step = { type: "wait", duration: 2000 };
      const result = primaryStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });
  });

  describe("Real-World Patterns", () => {
    it("should handle e-commerce checkout flow", () => {
      const steps = [
        { type: "wait", for: ".product-page" },
        { type: "click", target: ".add-to-cart", wait: ".cart-updated" },
        { type: "click", target: ".checkout-button", wait: ".checkout-form" },
        { type: "fill", target: "#email", value: "user@example.com" },
        { type: "fill", target: "#card-number", value: "4242424242424242" },
        { type: "screenshot" },
      ];
      
      const normalized = normalizeAllSteps(steps);
      const result = preValidateSteps(normalized, "https://example.com");
      
      expect(result.valid).toBe(true);
      expect(result.canProceed).toBe(true);
    });

    it("should handle form with multiple fields", () => {
      const steps = [
        { type: "viewport", device: "desktop" },
        { type: "wait", for: "form" },
        { type: "fill", target: "#firstName", value: "John" },
        { type: "fill", target: "#lastName", value: "Doe" },
        { type: "fill", target: "#email", value: "john@example.com" },
        { type: "fill", target: "#agree", value: "true" },
        { type: "click", target: "button[type=submit]", wait: ".success" },
      ];
      
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.valid).toBe(true);
      // Viewport should be first in the original or corrected steps
      const firstStep = result.correctedSteps ? result.correctedSteps[0] : steps[0];
      expect(firstStep.type).toBe("viewport");
    });

    it("should handle SPA navigation", () => {
      const steps = [
        { type: "wait", for: ".app-loaded" },
        { type: "click", target: ".nav-link", wait: ".page-content" },
        { type: "wait", for: ".data-loaded" },
        { type: "scroll", to: ".footer" },
        { type: "screenshot", fullPage: true },
      ];
      
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.valid).toBe(true);
      // May have warnings about dynamic selectors, that's okay
      expect(result.canProceed).toBe(true);
    });
  });
});
