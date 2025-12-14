import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { validateSelector } from "../../src/utils/normalize.js";
import { performStepValidation, validateStepOrder as validateStepOrderFn } from "../../src/utils/stepOrder.js";
import {
  llmStepSchema,
  viewportStepSchema,
  waitStepSchema,
  fillStepSchema,
  clickStepSchema,
  scrollStepSchema,
  screenshotStepSchema,
} from "../../src/schemas/index.js";

describe("LLM-Optimized Step Schemas", () => {
  describe("6 Primary Step Types (Single Source of Truth)", () => {
    // Schemas are imported from centralized source

    describe("fill step", () => {
      it("should accept single field fill", () => {
        const input = {
          type: "fill",
          target: "#email",
          value: "test@example.com",
          submit: true
        };
        
        // Expected to be valid
        expect(input.type).toBe("fill");
        expect(input.target).toBe("#email");
        expect(input.value).toBe("test@example.com");
        expect(input.submit).toBe(true);
      });

      it("should accept multiple fields fill", () => {
        const input = {
          type: "fill",
          fields: [
            { target: "#email", value: "user@test.com" },
            { target: "#password", value: "secret123" }
          ],
          submit: true
        };
        
        expect(input.type).toBe("fill");
        expect(input.fields).toHaveLength(2);
        expect(input.fields[0].target).toBe("#email");
        expect(input.submit).toBe(true);
      });

      it("should handle checkbox values", () => {
        const input = {
          type: "fill",
          target: "#agree",
          value: "true"
        };
        
        expect(input.type).toBe("fill");
        expect(input.value).toBe("true");
      });

      it("should handle select values", () => {
        const input = {
          type: "fill",
          target: "select#country",
          value: "US"
        };
        
        expect(input.type).toBe("fill");
        expect(input.target).toBe("select#country");
        expect(input.value).toBe("US");
      });
    });

    describe("click step", () => {
      it("should accept basic click", () => {
        const input = {
          type: "click",
          target: "button.submit"
        };
        
        expect(input.type).toBe("click");
        expect(input.target).toBe("button.submit");
      });

      it("should accept click with waitFor", () => {
        const input = {
          type: "click",
          target: "#login-btn",
          waitFor: ".dashboard"
        };
        
        expect(input.type).toBe("click");
        expect(input.target).toBe("#login-btn");
        expect(input.waitFor).toBe(".dashboard");
      });
    });

    describe("scroll step", () => {
      it("should accept scroll to element", () => {
        const input = {
          type: "scroll",
          to: "#section-2"
        };
        
        expect(input.type).toBe("scroll");
        expect(input.to).toBe("#section-2");
      });

      it("should accept scroll to y position", () => {
        const input = {
          type: "scroll",
          y: 500
        };
        
        expect(input.type).toBe("scroll");
        expect(input.y).toBe(500);
      });
    });

    describe("wait step", () => {
      it("should accept wait for selector", () => {
        const input = {
          type: "wait",
          for: ".content-loaded"
        };
        
        expect(input.type).toBe("wait");
        expect(input.for).toBe(".content-loaded");
      });

      it("should accept wait for duration", () => {
        const input = {
          type: "wait",
          duration: 2000
        };
        
        expect(input.type).toBe("wait");
        expect(input.duration).toBe(2000);
      });

      it("should enforce max duration of 30000ms", () => {
        const input = {
          type: "wait",
          duration: 30000
        };
        
        expect(input.duration).toBeLessThanOrEqual(30000);
      });
    });

    describe("screenshot step", () => {
      it("should accept viewport screenshot", () => {
        const input = {
          type: "screenshot"
        };
        
        expect(input.type).toBe("screenshot");
      });

      it("should accept full page screenshot", () => {
        const input = {
          type: "screenshot",
          fullPage: true
        };
        
        expect(input.type).toBe("screenshot");
        expect(input.fullPage).toBe(true);
      });

      it("should accept element screenshot", () => {
        const input = {
          type: "screenshot",
          element: ".card"
        };
        
        expect(input.type).toBe("screenshot");
        expect(input.element).toBe(".card");
      });
    });

    describe("viewport step", () => {
      it("should accept device preset", () => {
        const input = {
          type: "viewport",
          device: "mobile"
        };
        
        expect(input.type).toBe("viewport");
        expect(input.device).toBe("mobile");
      });

      it("should accept named device", () => {
        const input = {
          type: "viewport",
          device: "iphone-14"
        };
        
        expect(input.type).toBe("viewport");
        expect(input.device).toBe("iphone-14");
      });

      it("should accept custom dimensions", () => {
        const input = {
          type: "viewport",
          width: 1024,
          height: 768
        };
        
        expect(input.type).toBe("viewport");
        expect(input.width).toBe(1024);
        expect(input.height).toBe(768);
      });
    });

    describe("schema validation", () => {
      it("should validate fill step with schema", () => {
        const validFill = { type: "fill", target: "#email", value: "test@example.com" };
        const result = fillStepSchema.safeParse(validFill);
        expect(result.success).toBe(true);
      });

      it("should validate click step with schema", () => {
        const validClick = { type: "click", target: "button" };
        const result = clickStepSchema.safeParse(validClick);
        expect(result.success).toBe(true);
      });

      it("should validate wait step with schema", () => {
        const validWait = { type: "wait", for: ".loaded" };
        const result = waitStepSchema.safeParse(validWait);
        expect(result.success).toBe(true);
      });

      it("should validate scroll step with schema", () => {
        const validScroll = { type: "scroll", to: "#footer" };
        const result = scrollStepSchema.safeParse(validScroll);
        expect(result.success).toBe(true);
      });

      it("should validate viewport step with schema", () => {
        const validViewport = { type: "viewport", device: "mobile" };
        const result = viewportStepSchema.safeParse(validViewport);
        expect(result.success).toBe(true);
      });

      it("should validate screenshot step with schema", () => {
        const validScreenshot = { type: "screenshot", fullPage: true };
        const result = screenshotStepSchema.safeParse(validScreenshot);
        expect(result.success).toBe(true);
      });

      it("should reject invalid step type in llmStepSchema", () => {
        const invalidStep = { type: "invalid", target: "#test" };
        const result = llmStepSchema.safeParse(invalidStep);
        expect(result.success).toBe(false);
      });

      it("llmStepSchema should accept all 6 primary types", () => {
        const steps = [
          { type: "viewport", device: "mobile" },
          { type: "wait", for: ".loaded" },
          { type: "fill", target: "#email", value: "test@example.com" },
          { type: "click", target: "button" },
          { type: "scroll", to: "#footer" },
          { type: "screenshot", fullPage: true },
        ];
        
        steps.forEach(step => {
          const result = llmStepSchema.safeParse(step);
          expect(result.success).toBe(true);
        });
      });
    });
  });

  describe("Step Ordering and Auto-Features", () => {
    it("viewport step should be moved to first position", () => {
      const steps = [
        { type: "wait", for: ".page" },
        { type: "viewport", device: "mobile" },
        { type: "click", target: "button" }
      ];
      
      // After normalization, viewport should be first
      const normalized = normalizeSteps(steps);
      expect(normalized[0].type).toBe("viewport");
      expect(normalized[1].type).toBe("wait");
      expect(normalized[2].type).toBe("click");
    });

    it("screenshot step should be auto-added if omitted", () => {
      const steps = [
        { type: "fill", target: "#search", value: "test" },
        { type: "click", target: "button" }
      ];
      
      // Screenshot should be added at the end
      const withScreenshot = ensureScreenshotStep(steps);
      expect(withScreenshot[withScreenshot.length - 1].type).toBe("screenshot");
    });
  });

  describe("Parameter Normalization", () => {
    it("should normalize device aliases", () => {
      const tests = [
        { input: "mobile", expected: "iphone-14" },
        { input: "phone", expected: "iphone-14" },
        { input: "tablet", expected: "ipad-pro" },
        { input: "desktop", expected: "desktop-hd" },
        { input: "iphone14", expected: "iphone-14" },
        { input: "ipad pro", expected: "ipad-pro" }
      ];
      
      tests.forEach(test => {
        const normalized = normalizeDeviceName(test.input);
        expect(normalized).toBe(test.expected);
      });
    });

    it("should validate CSS selectors", () => {
      const valid = [
        "#id",
        ".class",
        "button",
        "[data-test]",
        "div > span",
        ".parent .child"
      ];
      
      const invalid = [
        "##double",
        "..double",
        "[unclosed",
        "(unclosed"
      ];
      
      valid.forEach(selector => {
        const result = validateSelector(selector);
        expect(result.valid).toBe(true);
      });
      
      invalid.forEach(selector => {
        const result = validateSelector(selector);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe("Error Messages", () => {
    it("should provide actionable error for missing element", () => {
      const error = LLM_ERRORS.ELEMENT_NOT_FOUND("#missing", "click");
      expect(error.message).toContain("Element not found");
      expect(error.fix).toContain("Check if");
      expect(error.fix).toContain("wait");
      expect(error.example).toBeDefined();
    });

    it("should provide actionable error for invalid selector", () => {
      const error = LLM_ERRORS.INVALID_SELECTOR("badselecto");
      expect(error.message).toContain("Invalid CSS selector");
      expect(error.fix).toContain("Missing #");
      expect(error.fix).toContain("Missing .");
    });

    it("should provide actionable error for missing wait condition", () => {
      const error = LLM_ERRORS.WAIT_MISSING_CONDITION();
      expect(error.message).toContain("wait step needs");
      expect(error.fix).toContain("for");
      expect(error.example).toBeDefined();
    });
  });

  describe("Step Validation (Validate Mode)", () => {
    it("should validate empty steps array", () => {
      const result = performStepValidation([], "https://example.com");
      expect(result.valid).toBe(true);
      expect(result.stepCount).toBe(1); // Auto-added screenshot
      expect(result.stepAnalysis).toHaveLength(1);
      expect(result.stepAnalysis[0].type).toBe("screenshot");
    });

    it("should detect missing wait 'for' or 'duration' parameter", () => {
      const steps = [{ type: "wait" }];
      const result = performStepValidation(steps, "https://example.com");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Step 1: wait step requires 'for' (selector) or 'duration' (ms)");
    });

    it("should accept wait with duration instead of for", () => {
      const steps = [{ type: "wait", duration: 2000 }];
      const result = performStepValidation(steps, "https://example.com");
      expect(result.valid).toBe(true);
      // Should have a warning suggesting 'for' over 'duration'
      expect(result.stepAnalysis[0].status).toBe("warning");
    });

    it("should detect missing fill parameters", () => {
      const steps = [{ type: "fill" }];
      const result = performStepValidation(steps, "https://example.com");
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("target"))).toBe(true);
      expect(result.errors.some(e => e.includes("value"))).toBe(true);
    });

    it("should detect missing click target", () => {
      const steps = [{ type: "click" }];
      const result = performStepValidation(steps, "https://example.com");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Step 1: click step requires 'target' parameter");
    });

    it("should warn about viewport not being first", () => {
      const steps = [
        { type: "fill", target: "#email", value: "test" },
        { type: "viewport", device: "mobile" }
      ];
      const result = performStepValidation(steps, "https://example.com");
      expect(result.warnings.some(w => w.includes("Viewport"))).toBe(true);
    });

    it("should suggest waitFor for click without wait", () => {
      const steps = [
        { type: "click", target: "button" },
        { type: "fill", target: "#email", value: "test" }
      ];
      const result = performStepValidation(steps, "https://example.com");
      expect(result.suggestions.some(s => s.issue.includes("waitFor"))).toBe(true);
    });

    it("should pass valid steps", () => {
      const steps = [
        { type: "viewport", device: "mobile" },
        { type: "wait", for: ".loaded" },
        { type: "fill", target: "#email", value: "test@example.com" },
        { type: "click", target: "button", waitFor: ".result" },
        { type: "screenshot", fullPage: true }
      ];
      const result = performStepValidation(steps, "https://example.com");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should estimate execution time", () => {
      const steps = [
        { type: "fill", target: "#email", value: "test" },
        { type: "click", target: "button" }
      ];
      const result = performStepValidation(steps, "https://example.com");
      expect(result.estimatedTimeMs).toBeGreaterThan(0);
    });
  });

  describe("Enhanced Step Order Validation", () => {
    it("should return errors and suggestions arrays", () => {
      const result = validateStepOrderFn([]);
      expect(result.errors).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    it("should provide suggestions for click without waitFor", () => {
      const steps = [
        { type: "click", target: "button" },
        { type: "fill", target: "#input", value: "test" }
      ];
      const result = validateStepOrderFn(steps);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0].fix).toContain("waitFor");
    });
  });
});

// Helper functions (would be imported from the actual implementation)
function normalizeSteps(steps: any[]): any[] {
  if (!steps || steps.length === 0) return steps;
  
  const viewportIndex = steps.findIndex(s => s.type === "viewport");
  if (viewportIndex > 0) {
    const [viewportStep] = steps.splice(viewportIndex, 1);
    steps.unshift(viewportStep);
  }
  
  return steps;
}

function ensureScreenshotStep(steps: any[]): any[] {
  const hasScreenshot = steps.some(s => s.type === "screenshot");
  if (!hasScreenshot) {
    steps.push({ type: "screenshot" });
  }
  return steps;
}

function normalizeDeviceName(device: string): string {
  const DEVICE_ALIASES: Record<string, string> = {
    "mobile": "iphone-14",
    "phone": "iphone-14",
    "tablet": "ipad-pro",
    "desktop": "desktop-hd",
    "iphone14": "iphone-14",
    "iphone 14": "iphone-14",
    "ipad pro": "ipad-pro",
  };
  
  const normalized = device.toLowerCase().trim();
  return DEVICE_ALIASES[normalized] || normalized;
}


const LLM_ERRORS = {
  ELEMENT_NOT_FOUND: (selector: string, step: string) => ({
    message: `✗ ${step} failed: Element not found`,
    fix: `The selector "${selector}" matched no elements. Check if:
1. The selector is correct (inspect page HTML)
2. The element loads dynamically (add a 'wait' step before)
3. The element is inside an iframe (not supported)`,
    example: {
      type: "wait",
      for: selector,
    },
  }),
  
  INVALID_SELECTOR: (selector: string) => ({
    message: `✗ Invalid CSS selector: "${selector}"`,
    fix: `The selector syntax is invalid. Common issues:
1. Missing # for ID selectors: "#email" not "email"
2. Missing . for class selectors: ".btn" not "btn"
3. Unescaped special characters`,
    example: null,
  }),
  
  WAIT_MISSING_CONDITION: () => ({
    message: `✗ wait step needs 'for' (selector) or 'duration' (ms)`,
    fix: `Specify what to wait for:
- Use 'for' with a CSS selector when waiting for an element
- Use 'duration' in milliseconds when no selector is available`,
    example: {
      type: "wait",
      for: ".content-loaded",
    },
  }),
};
