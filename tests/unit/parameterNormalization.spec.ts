import { describe, it, expect } from "vitest";
import { normalizeStepParameters, normalizeAllSteps } from "../../src/utils/parameterNormalization.js";

describe("parameterNormalization", () => {
  describe("normalizeStepParameters", () => {
    it("should normalize selector to target", () => {
      const step = { type: "click", selector: "button" };
      const normalized = normalizeStepParameters(step);
      expect(normalized.target).toBe("button");
      expect(normalized.selector).toBeUndefined();
    });

    it("should normalize awaitElement to for", () => {
      const step = { type: "wait", awaitElement: ".content" };
      const normalized = normalizeStepParameters(step);
      expect(normalized.for).toBe(".content");
      expect(normalized.awaitElement).toBeUndefined();
    });

    it("should normalize scrollTo to to", () => {
      const step = { type: "scroll", scrollTo: "#footer" };
      const normalized = normalizeStepParameters(step);
      expect(normalized.to).toBe("#footer");
      expect(normalized.scrollTo).toBeUndefined();
    });

    it("should normalize waitAfter to wait", () => {
      const step = { type: "click", target: "button", waitAfter: ".result" };
      const normalized = normalizeStepParameters(step);
      expect(normalized.wait).toBe(".result");
      expect(normalized.waitAfter).toBeUndefined();
    });

    it("should normalize waitForSelector to wait", () => {
      const step = { type: "click", target: "button", waitForSelector: ".modal" };
      const normalized = normalizeStepParameters(step);
      expect(normalized.wait).toBe(".modal");
      expect(normalized.waitForSelector).toBeUndefined();
    });

    it("should normalize captureElement to element", () => {
      const step = { type: "screenshot", captureElement: ".hero" };
      const normalized = normalizeStepParameters(step);
      expect(normalized.element).toBe(".hero");
      expect(normalized.captureElement).toBeUndefined();
    });

    it("should normalize preset to device", () => {
      const step = { type: "viewport", preset: "mobile" };
      const normalized = normalizeStepParameters(step);
      expect(normalized.device).toBe("mobile");
      expect(normalized.preset).toBeUndefined();
    });

    it("should normalize waitForSelector step type to wait", () => {
      const step = { type: "waitForSelector", awaitElement: ".content" };
      const normalized = normalizeStepParameters(step);
      expect(normalized.type).toBe("wait");
      expect(normalized.for).toBe(".content");
      expect(normalized.awaitElement).toBeUndefined();
    });

    it("should normalize delay step type to wait", () => {
      const step = { type: "delay", duration: 1000 };
      const normalized = normalizeStepParameters(step);
      expect(normalized.type).toBe("wait");
      expect(normalized.duration).toBe(1000);
    });

    it("should not override existing canonical parameters", () => {
      const step = { type: "click", target: "button", selector: "old-button" };
      const normalized = normalizeStepParameters(step);
      expect(normalized.target).toBe("button");
      expect(normalized.selector).toBeUndefined();
    });

    it("should preserve other parameters", () => {
      const step = { type: "fill", target: "#email", value: "test@example.com", submit: true };
      const normalized = normalizeStepParameters(step);
      expect(normalized.type).toBe("fill");
      expect(normalized.target).toBe("#email");
      expect(normalized.value).toBe("test@example.com");
      expect(normalized.submit).toBe(true);
    });
  });

  describe("normalizeAllSteps", () => {
    it("should normalize multiple steps", () => {
      const steps = [
        { type: "waitForSelector", awaitElement: ".content" },
        { type: "click", selector: "button" },
        { type: "scroll", scrollTo: "#footer" },
      ];
      const normalized = normalizeAllSteps(steps);
      
      expect(normalized[0].type).toBe("wait");
      expect(normalized[0].for).toBe(".content");
      expect(normalized[1].target).toBe("button");
      expect(normalized[2].to).toBe("#footer");
    });

    it("should handle empty array", () => {
      const normalized = normalizeAllSteps([]);
      expect(normalized).toEqual([]);
    });

    it("should not mutate original steps", () => {
      const steps = [{ type: "click", selector: "button" }];
      const normalized = normalizeAllSteps(steps);
      
      expect(steps[0].selector).toBe("button");
      expect(normalized[0].target).toBe("button");
    });
  });
});
