import { describe, it, expect } from "vitest";
import { 
  primaryStepSchema, 
  allStepsSchema,
  viewportStep,
  waitStep,
  fillStep,
  clickStep,
  scrollStep,
  screenshotStep,
  typeStep,
  hoverStep,
  cookieStep,
  storageStep,
  delayStep,
  evaluateStep
} from "../../src/schemas/steps.js";

describe("steps schema", () => {
  describe("primaryStepSchema", () => {
    it("should validate viewport step", () => {
      const step = { type: "viewport", device: "mobile" };
      const result = primaryStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should validate wait step", () => {
      const step = { type: "wait", for: ".content" };
      const result = primaryStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should validate fill step", () => {
      const step = { type: "fill", target: "#email", value: "test@example.com" };
      const result = primaryStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should validate click step", () => {
      const step = { type: "click", target: "button" };
      const result = primaryStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should validate scroll step", () => {
      const step = { type: "scroll", to: "#footer" };
      const result = primaryStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should validate screenshot step", () => {
      const step = { type: "screenshot", fullPage: true };
      const result = primaryStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should reject invalid step type", () => {
      const step = { type: "invalid" };
      const result = primaryStepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });

    it("should reject extended step types", () => {
      const step = { type: "type", target: "#input", text: "hello" };
      const result = primaryStepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });
  });

  describe("viewportStep", () => {
    it("should accept device parameter", () => {
      const step = { type: "viewport", device: "iphone-14" };
      const result = viewportStep.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should accept custom dimensions", () => {
      const step = { type: "viewport", width: 1024, height: 768 };
      const result = viewportStep.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should reject negative dimensions", () => {
      const step = { type: "viewport", width: -100, height: 768 };
      const result = viewportStep.safeParse(step);
      expect(result.success).toBe(false);
    });
  });

  describe("waitStep", () => {
    it("should accept for parameter", () => {
      const step = { type: "wait", for: ".loaded" };
      const result = waitStep.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should accept timeout parameter", () => {
      const step = { type: "wait", for: ".content", timeout: 15000 };
      const result = waitStep.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should reject empty selector", () => {
      const step = { type: "wait", for: "" };
      const result = waitStep.safeParse(step);
      expect(result.success).toBe(false);
    });

    it("should reject timeout over limit", () => {
      const step = { type: "wait", for: ".content", timeout: 40000 };
      const result = waitStep.safeParse(step);
      expect(result.success).toBe(false);
    });
  });

  describe("fillStep", () => {
    it("should accept basic fill", () => {
      const step = { type: "fill", target: "#email", value: "test@example.com" };
      const result = fillStep.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should accept submit parameter", () => {
      const step = { type: "fill", target: "#search", value: "query", submit: true };
      const result = fillStep.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should reject empty target", () => {
      const step = { type: "fill", target: "", value: "test" };
      const result = fillStep.safeParse(step);
      expect(result.success).toBe(false);
    });
  });

  describe("clickStep", () => {
    it("should accept basic click", () => {
      const step = { type: "click", target: "button" };
      const result = clickStep.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should accept waitFor parameter", () => {
      const step = { type: "click", target: "button", waitFor: ".modal" };
      const result = clickStep.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should reject empty target", () => {
      const step = { type: "click", target: "" };
      const result = clickStep.safeParse(step);
      expect(result.success).toBe(false);
    });
  });

  describe("scrollStep", () => {
    it("should accept to parameter", () => {
      const step = { type: "scroll", to: "#section-2" };
      const result = scrollStep.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should accept y parameter", () => {
      const step = { type: "scroll", y: 500 };
      const result = scrollStep.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should reject negative y", () => {
      const step = { type: "scroll", y: -100 };
      const result = scrollStep.safeParse(step);
      expect(result.success).toBe(false);
    });
  });

  describe("screenshotStep", () => {
    it("should accept fullPage parameter", () => {
      const step = { type: "screenshot", fullPage: true };
      const result = screenshotStep.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should accept element parameter", () => {
      const step = { type: "screenshot", element: ".hero" };
      const result = screenshotStep.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should accept minimal screenshot", () => {
      const step = { type: "screenshot" };
      const result = screenshotStep.safeParse(step);
      expect(result.success).toBe(true);
    });
  });

  describe("allStepsSchema", () => {
    it("should accept primary steps", () => {
      const step = { type: "fill", target: "#email", value: "test" };
      const result = allStepsSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should accept extended steps", () => {
      const step = { type: "type", target: "#input", text: "hello" };
      const result = allStepsSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should validate type step", () => {
      const step = { type: "type", target: "#input", text: "hello", pressEnter: true };
      const result = allStepsSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should validate hover step", () => {
      const step = { type: "hover", target: ".dropdown", duration: 1000 };
      const result = allStepsSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should validate cookie step", () => {
      const step = { type: "cookie", action: "set", name: "session", value: "abc123" };
      const result = allStepsSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should validate storage step", () => {
      const step = { type: "storage", storageType: "localStorage", action: "set", key: "theme", value: "dark" };
      const result = allStepsSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should validate delay step", () => {
      const step = { type: "delay", duration: 2000 };
      const result = allStepsSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it("should validate evaluate step", () => {
      const step = { type: "evaluate", script: "console.log('test')" };
      const result = allStepsSchema.safeParse(step);
      expect(result.success).toBe(true);
    });
  });
});
