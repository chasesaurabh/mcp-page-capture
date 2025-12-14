import { describe, it, expect } from "vitest";
import { preValidateSteps } from "../../src/utils/preValidation.js";

describe("preValidation", () => {
  describe("preValidateSteps", () => {
    it("should move viewport to first position", () => {
      const steps = [
        { type: "click", target: "button" },
        { type: "viewport", device: "mobile" },
        { type: "fill", target: "#search", value: "test" },
      ];
      
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.valid).toBe(true);
      expect(result.corrections).toHaveLength(1);
      expect(result.corrections[0].reason).toContain("viewport must be first");
      expect(result.correctedSteps![0].type).toBe("viewport");
    });

    it("should warn about missing wait before dynamic actions", () => {
      const steps = [
        { type: "click", target: ".dynamic-button" },
      ];
      
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("Consider adding");
      expect(result.warnings[0]).toContain("wait");
    });

    it("should not warn for static selectors", () => {
      const steps = [
        { type: "click", target: "button" },
      ];
      
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.warnings).toHaveLength(0);
    });

    it("should trim whitespace in selectors", () => {
      const steps = [
        { type: "click", target: "  button  " },
      ];
      
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.valid).toBe(true);
      expect(result.corrections.length).toBeGreaterThan(0);
      expect(result.corrections[0].reason).toContain("whitespace");
    });

    it("should warn about steps after screenshot", () => {
      const steps = [
        { type: "fill", target: "#search", value: "test" },
        { type: "screenshot" },
        { type: "click", target: "button" },
      ];
      
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("after screenshot");
    });

    it("should not warn about wait/delay after screenshot", () => {
      const steps = [
        { type: "screenshot" },
        { type: "wait", for: ".content" },
      ];
      
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.warnings).toHaveLength(0);
    });

    it("should handle multiple corrections", () => {
      const steps = [
        { type: "click", target: "button" },
        { type: "viewport", device: "mobile" },
      ];
      
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.corrections.length).toBeGreaterThan(0);
      expect(result.correctedSteps).toBeDefined();
    });

    it("should allow proceeding when only warnings exist", () => {
      const steps = [
        { type: "click", target: ".dynamic-element" },
      ];
      
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.canProceed).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should handle steps with valid selectors", () => {
      const steps = [
        { type: "click", target: "button" },
        { type: "wait", for: ".content" },
      ];
      
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.valid).toBe(true);
      expect(result.canProceed).toBe(true);
    });

    it("should handle empty steps array", () => {
      const result = preValidateSteps([], "https://example.com");
      
      expect(result.valid).toBe(true);
      expect(result.canProceed).toBe(true);
      expect(result.corrections).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate all selector types (target, for, to)", () => {
      const steps = [
        { type: "click", target: "  button  " },
        { type: "wait", for: "  .content  " },
        { type: "scroll", to: "  #footer  " },
      ];
      
      const result = preValidateSteps(steps, "https://example.com");
      
      expect(result.corrections.length).toBe(3);
      expect(result.corrections.every(c => c.reason.includes("whitespace"))).toBe(true);
    });
  });
});
