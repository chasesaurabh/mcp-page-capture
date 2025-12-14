import { describe, it, expect } from "vitest";
import { mapToCanonicalStep, expandFillForm, normalizeStepsArray } from "../../src/utils/stepMapper.js";

describe("Step Mapper", () => {
  describe("mapToCanonicalStep", () => {
    describe("fill step mapping", () => {
      it("should map quickFill to fill", () => {
        const input = { type: "quickFill", target: "#search", value: "test", submit: true };
        const result = mapToCanonicalStep(input);
        expect(result.type).toBe("fill");
        expect(result.target).toBe("#search");
        expect(result.value).toBe("test");
        expect(result.submit).toBe(true);
      });

      it("should map text to fill", () => {
        const input = { type: "text", selector: "#email", value: "user@test.com" };
        const result = mapToCanonicalStep(input);
        expect(result.type).toBe("fill");
        expect(result.target).toBe("#email");
        expect(result.value).toBe("user@test.com");
      });

      it("should map type to fill", () => {
        const input = { type: "type", target: "#input", text: "typed text" };
        const result = mapToCanonicalStep(input);
        expect(result.type).toBe("fill");
        expect(result.target).toBe("#input");
        expect(result.value).toBe("typed text");
      });

      it("should map select to fill", () => {
        const input = { type: "select", selector: "select#country", value: "US" };
        const result = mapToCanonicalStep(input);
        expect(result.type).toBe("fill");
        expect(result.target).toBe("select#country");
        expect(result.value).toBe("US");
      });

      it("should map checkbox to fill with boolean value", () => {
        const input = { type: "checkbox", selector: "#agree", checked: true };
        const result = mapToCanonicalStep(input);
        expect(result.type).toBe("fill");
        expect(result.target).toBe("#agree");
        expect(result.value).toBe("true");
      });

      it("should map radio to fill", () => {
        const input = { type: "radio", selector: "input[name=gender]", value: "male" };
        const result = mapToCanonicalStep(input);
        expect(result.type).toBe("fill");
        expect(result.target).toBe("input[name=gender]");
        expect(result.value).toBe("male");
      });
    });

    describe("wait step mapping", () => {
      it("should map waitForSelector to wait", () => {
        const input = { type: "waitForSelector", awaitElement: ".loaded" };
        const result = mapToCanonicalStep(input);
        expect(result.type).toBe("wait");
        expect(result.for).toBe(".loaded");
      });

      it("should map delay to wait", () => {
        const input = { type: "delay", duration: 2000 };
        const result = mapToCanonicalStep(input);
        expect(result.type).toBe("wait");
        expect(result.duration).toBe(2000);
      });

      it("should handle selector parameter in waitForSelector", () => {
        const input = { type: "waitForSelector", selector: "#content" };
        const result = mapToCanonicalStep(input);
        expect(result.type).toBe("wait");
        expect(result.for).toBe("#content");
      });
    });

    describe("click step mapping", () => {
      it("should map click with selector to target", () => {
        const input = { type: "click", selector: "button.submit" };
        const result = mapToCanonicalStep(input);
        expect(result.type).toBe("click");
        expect(result.target).toBe("button.submit");
      });

      it("should map click with waitAfter", () => {
        const input = { type: "click", target: "#btn", waitAfter: ".modal" };
        const result = mapToCanonicalStep(input);
        expect(result.type).toBe("click");
        expect(result.target).toBe("#btn");
        expect(result.wait).toBe(".modal");
      });

      it("should map submit to click", () => {
        const input = { type: "submit", selector: "form" };
        const result = mapToCanonicalStep(input);
        expect(result.type).toBe("click");
        expect(result.target).toBe("form");
      });
    });

    describe("scroll step mapping", () => {
      it("should map scroll with scrollTo to to", () => {
        const input = { type: "scroll", scrollTo: "#section2" };
        const result = mapToCanonicalStep(input);
        expect(result.type).toBe("scroll");
        expect(result.to).toBe("#section2");
      });

      it("should map scroll with y position", () => {
        const input = { type: "scroll", y: 500 };
        const result = mapToCanonicalStep(input);
        expect(result.type).toBe("scroll");
        expect(result.y).toBe(500);
      });
    });

    describe("screenshot step mapping", () => {
      it("should map screenshot with fullPage", () => {
        const input = { type: "screenshot", fullPage: true };
        const result = mapToCanonicalStep(input);
        expect(result.type).toBe("screenshot");
        expect(result.fullPage).toBe(true);
      });

      it("should map screenshot with captureElement to element", () => {
        const input = { type: "screenshot", captureElement: ".card" };
        const result = mapToCanonicalStep(input);
        expect(result.type).toBe("screenshot");
        expect(result.element).toBe(".card");
      });

      it("should map fullPage type to screenshot", () => {
        const input = { type: "fullPage", enabled: true };
        const result = mapToCanonicalStep(input);
        expect(result.type).toBe("screenshot");
        expect(result.fullPage).toBe(true);
      });
    });

    describe("viewport step mapping", () => {
      it("should map viewport with preset to device", () => {
        const input = { type: "viewport", preset: "iphone-14" };
        const result = mapToCanonicalStep(input);
        expect(result.type).toBe("viewport");
        expect(result.device).toBe("iphone-14");
      });

      it("should preserve custom dimensions", () => {
        const input = { type: "viewport", width: 1024, height: 768 };
        const result = mapToCanonicalStep(input);
        expect(result.type).toBe("viewport");
        expect(result.width).toBe(1024);
        expect(result.height).toBe(768);
      });
    });
  });

  describe("expandFillForm", () => {
    it("should expand fillForm with multiple fields", () => {
      const input = {
        type: "fillForm",
        fields: [
          { selector: "#email", value: "user@test.com" },
          { selector: "#password", value: "secret123" }
        ]
      };
      const result = expandFillForm(input);
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("fill");
      expect(result[0].target).toBe("#email");
      expect(result[1].type).toBe("fill");
      expect(result[1].target).toBe("#password");
    });

    it("should add submit click when submit is true", () => {
      const input = {
        type: "fillForm",
        fields: [
          { selector: "#email", value: "user@test.com" }
        ],
        submit: true
      };
      const result = expandFillForm(input);
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("fill");
      expect(result[1].type).toBe("click");
    });

    it("should use submitSelector if provided", () => {
      const input = {
        type: "fillForm",
        fields: [
          { selector: "#email", value: "user@test.com" }
        ],
        submit: true,
        submitSelector: "#custom-submit"
      };
      const result = expandFillForm(input);
      expect(result).toHaveLength(2);
      expect(result[1].type).toBe("click");
      expect(result[1].target).toBe("#custom-submit");
    });

    it("should return single mapped step for non-fillForm types", () => {
      const input = { type: "click", target: "button" };
      const result = expandFillForm(input);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("click");
    });
  });

  describe("normalizeStepsArray", () => {
    it("should normalize array of mixed step types", () => {
      const steps = [
        { type: "waitForSelector", awaitElement: ".page" },
        { type: "quickFill", target: "#search", value: "test" },
        { type: "click", selector: "button" }
      ];
      const result = normalizeStepsArray(steps);
      expect(result).toHaveLength(3);
      expect(result[0].type).toBe("wait");
      expect(result[1].type).toBe("fill");
      expect(result[2].type).toBe("click");
    });

    it("should expand fillForm steps", () => {
      const steps = [
        {
          type: "fillForm",
          fields: [
            { selector: "#email", value: "user@test.com" },
            { selector: "#password", value: "pass" }
          ],
          submit: true
        }
      ];
      const result = normalizeStepsArray(steps);
      expect(result).toHaveLength(3); // 2 fills + 1 click
      expect(result[0].type).toBe("fill");
      expect(result[1].type).toBe("fill");
      expect(result[2].type).toBe("click");
    });

    it("should handle empty array", () => {
      const result = normalizeStepsArray([]);
      expect(result).toHaveLength(0);
    });

    it("should preserve canonical step types", () => {
      const steps = [
        { type: "fill", target: "#input", value: "test" },
        { type: "wait", for: ".loaded" }
      ];
      const result = normalizeStepsArray(steps);
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("fill");
      expect(result[1].type).toBe("wait");
    });
  });
});
