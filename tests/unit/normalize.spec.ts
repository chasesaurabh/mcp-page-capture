import { describe, it, expect } from "vitest";
import { 
  normalizeDeviceName, 
  normalizeUrlInput, 
  normalizeSelector, 
  normalizeFillValue,
  normalizeStepParams,
  normalizeAllSteps
} from "../../src/utils/normalize.js";

describe("Normalize Utilities", () => {
  describe("normalizeDeviceName", () => {
    it("should normalize generic device terms", () => {
      expect(normalizeDeviceName("mobile")).toBe("iphone-16-pro");
      expect(normalizeDeviceName("phone")).toBe("iphone-16-pro");
      expect(normalizeDeviceName("smartphone")).toBe("iphone-16-pro");
      expect(normalizeDeviceName("tablet")).toBe("ipad-pro");
      expect(normalizeDeviceName("desktop")).toBe("desktop-fhd");
      expect(normalizeDeviceName("laptop")).toBe("macbook-pro-16");
      expect(normalizeDeviceName("pc")).toBe("desktop-fhd");
    });

    it("should normalize Apple device variations", () => {
      expect(normalizeDeviceName("iphone")).toBe("iphone-16-pro");
      expect(normalizeDeviceName("iphone16")).toBe("iphone-16-pro");
      expect(normalizeDeviceName("iphone 16")).toBe("iphone-16-pro");
      expect(normalizeDeviceName("iphone14")).toBe("iphone-14");
      expect(normalizeDeviceName("iphone 14")).toBe("iphone-14");
      expect(normalizeDeviceName("ipad")).toBe("ipad-pro");
      expect(normalizeDeviceName("ipadpro")).toBe("ipad-pro");
      expect(normalizeDeviceName("ipad pro")).toBe("ipad-pro");
    });

    it("should normalize Android device variations", () => {
      expect(normalizeDeviceName("android")).toBe("pixel-9");
      expect(normalizeDeviceName("pixel")).toBe("pixel-9");
      expect(normalizeDeviceName("pixel9")).toBe("pixel-9");
      expect(normalizeDeviceName("pixel 9")).toBe("pixel-9");
      expect(normalizeDeviceName("samsung")).toBe("galaxy-s24");
      expect(normalizeDeviceName("galaxy")).toBe("galaxy-s24");
    });

    it("should normalize desktop variations", () => {
      expect(normalizeDeviceName("hd")).toBe("desktop-hd");
      expect(normalizeDeviceName("fullhd")).toBe("desktop-fhd");
      expect(normalizeDeviceName("full-hd")).toBe("desktop-fhd");
      expect(normalizeDeviceName("1080p")).toBe("desktop-fhd");
      expect(normalizeDeviceName("4k")).toBe("desktop-4k");
      expect(normalizeDeviceName("uhd")).toBe("desktop-4k");
    });

    it("should handle typos", () => {
      expect(normalizeDeviceName("iphon-16")).toBe("iphone-16-pro");
      expect(normalizeDeviceName("ipone-16")).toBe("iphone-16-pro");
      expect(normalizeDeviceName("andriod")).toBe("pixel-9");
      expect(normalizeDeviceName("pixle")).toBe("pixel-9");
    });

    it("should handle case insensitivity", () => {
      expect(normalizeDeviceName("MOBILE")).toBe("iphone-16-pro");
      expect(normalizeDeviceName("Mobile")).toBe("iphone-16-pro");
      expect(normalizeDeviceName("IPhone 16")).toBe("iphone-16-pro");
    });

    it("should return unknown devices unchanged", () => {
      expect(normalizeDeviceName("custom-device")).toBe("custom-device");
    });
  });

  describe("normalizeUrlInput", () => {
    it("should add https protocol if missing", () => {
      expect(normalizeUrlInput("example.com")).toBe("https://example.com");
      expect(normalizeUrlInput("www.example.com")).toBe("https://www.example.com");
    });

    it("should preserve existing protocol", () => {
      expect(normalizeUrlInput("https://example.com")).toBe("https://example.com");
      expect(normalizeUrlInput("http://example.com")).toBe("http://example.com");
    });

    it("should fix double protocol typos", () => {
      expect(normalizeUrlInput("http://http://example.com")).toBe("http://example.com");
      expect(normalizeUrlInput("https://https://example.com")).toBe("https://example.com");
    });

    it("should fix protocol typos", () => {
      expect(normalizeUrlInput("htps://example.com")).toBe("https://example.com");
      expect(normalizeUrlInput("htp://example.com")).toBe("http://example.com");
    });

    it("should trim whitespace", () => {
      expect(normalizeUrlInput("  example.com  ")).toBe("https://example.com");
      expect(normalizeUrlInput(" https://example.com ")).toBe("https://example.com");
    });
  });

  describe("normalizeSelector", () => {
    it("should not modify valid selectors", () => {
      const validSelectors = ["#id", ".class", "button", "div > span", "[data-test]"];
      validSelectors.forEach(selector => {
        const result = normalizeSelector(selector);
        expect(result.normalized).toBe(selector);
        expect(result.wasFixed).toBe(false);
      });
    });

    it("should fix bare words that look like IDs", () => {
      const result = normalizeSelector("email");
      expect(result.normalized).toBe("#email");
      expect(result.wasFixed).toBe(true);
      expect(result.suggestion).toContain("ID selector");
    });

    it("should fix bare words with button-like names as classes", () => {
      const result = normalizeSelector("submitbtn");
      expect(result.normalized).toBe(".submitbtn");
      expect(result.wasFixed).toBe(true);
      expect(result.suggestion).toContain("class selector");
    });

    it("should not fix valid HTML tags", () => {
      const tags = ["div", "button", "input", "span", "a"];
      tags.forEach(tag => {
        const result = normalizeSelector(tag);
        expect(result.wasFixed).toBe(false);
      });
    });

    it("should trim whitespace", () => {
      const result = normalizeSelector("  #id  ");
      expect(result.normalized).toBe("#id");
    });
  });

  describe("normalizeFillValue", () => {
    it("should normalize boolean true values", () => {
      expect(normalizeFillValue("true")).toBe("true");
      expect(normalizeFillValue("yes")).toBe("true");
      expect(normalizeFillValue("1")).toBe("true");
      expect(normalizeFillValue("on")).toBe("true");
      expect(normalizeFillValue("checked")).toBe("true");
    });

    it("should normalize boolean false values", () => {
      expect(normalizeFillValue("false")).toBe("false");
      expect(normalizeFillValue("no")).toBe("false");
      expect(normalizeFillValue("0")).toBe("false");
      expect(normalizeFillValue("off")).toBe("false");
      expect(normalizeFillValue("unchecked")).toBe("false");
    });

    it("should handle case insensitivity", () => {
      expect(normalizeFillValue("TRUE")).toBe("true");
      expect(normalizeFillValue("Yes")).toBe("true");
      expect(normalizeFillValue("FALSE")).toBe("false");
      expect(normalizeFillValue("No")).toBe("false");
    });

    it("should preserve non-boolean values", () => {
      expect(normalizeFillValue("test@example.com")).toBe("test@example.com");
      expect(normalizeFillValue("some text")).toBe("some text");
    });

    it("should trim whitespace", () => {
      expect(normalizeFillValue("  true  ")).toBe("true");
      expect(normalizeFillValue("  test  ")).toBe("test");
    });
  });

  describe("normalizeStepParams", () => {
    it("should normalize click step parameters", () => {
      const step = { type: "click", selector: "button", waitAfter: ".modal" };
      const result = normalizeStepParams(step);
      expect(result.target).toBe("button");
      expect(result.waitFor).toBe(".modal");
      expect(result.selector).toBeUndefined();
      expect(result.waitAfter).toBeUndefined();
    });

    it("should normalize wait step parameters", () => {
      const step = { type: "waitForSelector", awaitElement: ".loaded" };
      const result = normalizeStepParams(step);
      expect(result.type).toBe("wait");
      expect(result.for).toBe(".loaded");
      expect(result.awaitElement).toBeUndefined();
    });

    it("should normalize scroll step parameters", () => {
      const step = { type: "scroll", scrollTo: "#section" };
      const result = normalizeStepParams(step);
      expect(result.to).toBe("#section");
      expect(result.scrollTo).toBeUndefined();
    });

    it("should normalize screenshot step parameters", () => {
      const step = { type: "screenshot", captureElement: ".card" };
      const result = normalizeStepParams(step);
      expect(result.element).toBe(".card");
      expect(result.captureElement).toBeUndefined();
    });

    it("should normalize viewport step parameters", () => {
      const step = { type: "viewport", preset: "iphone-14" };
      const result = normalizeStepParams(step);
      expect(result.device).toBe("iphone-14");
      expect(result.preset).toBeUndefined();
    });

    it("should normalize fill/text/type step parameters", () => {
      const step = { type: "text", selector: "#input", text: "value" };
      const result = normalizeStepParams(step);
      expect(result.type).toBe("fill");
      expect(result.target).toBe("#input");
      expect(result.value).toBe("value");
      expect(result.selector).toBeUndefined();
      expect(result.text).toBeUndefined();
    });
  });

  describe("normalizeAllSteps", () => {
    it("should normalize all step parameters", () => {
      const steps = [
        { type: "waitForSelector", awaitElement: ".page" },
        { type: "click", selector: "button" }
      ];
      const result = normalizeAllSteps(steps);
      expect(result[0].type).toBe("wait");
      expect(result[0].for).toBe(".page");
      expect(result[1].type).toBe("click");
      expect(result[1].target).toBe("button");
    });

    it("should move viewport to first position", () => {
      const steps = [
        { type: "wait", for: ".page" },
        { type: "viewport", device: "mobile" },
        { type: "click", target: "button" }
      ];
      const result = normalizeAllSteps(steps);
      expect(result[0].type).toBe("viewport");
      expect(result[1].type).toBe("wait");
      expect(result[2].type).toBe("click");
    });

    it("should add screenshot at end if not present", () => {
      const steps = [
        { type: "fill", target: "#search", value: "test" }
      ];
      const result = normalizeAllSteps(steps);
      expect(result[result.length - 1].type).toBe("screenshot");
    });

    it("should not add duplicate screenshot", () => {
      const steps = [
        { type: "fill", target: "#search", value: "test" },
        { type: "screenshot", fullPage: true }
      ];
      const result = normalizeAllSteps(steps);
      const screenshotSteps = result.filter(s => s.type === "screenshot");
      expect(screenshotSteps).toHaveLength(1);
    });

    it("should handle empty array", () => {
      const result = normalizeAllSteps([]);
      expect(result).toHaveLength(0);
    });
  });
});
