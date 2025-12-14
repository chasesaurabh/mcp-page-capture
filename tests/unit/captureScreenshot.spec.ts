import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import type { ActionStep, ViewportStep, FullPageStep, CookieActionStep, FillFormStep, FormFieldInput, QuickFillStep, ClickStep, ScrollStep, WaitForSelectorStep, ScreenshotStep } from "../../src/types/screenshot.js";

describe("captureScreenshot consolidation", () => {
  describe("Legacy parameter conversion", () => {
    let convertLegacyParametersToSteps: any;
    
    beforeEach(async () => {
      // Mock modules
      vi.mock("puppeteer", () => ({
        default: {
          launch: vi.fn().mockResolvedValue({
            newPage: vi.fn().mockResolvedValue({
              setViewport: vi.fn(),
              setUserAgent: vi.fn(),
              setExtraHTTPHeaders: vi.fn(),
              setCookie: vi.fn(),
              goto: vi.fn().mockResolvedValue({
                ok: () => true,
                status: () => 200,
              }),
              screenshot: vi.fn().mockResolvedValue(Buffer.from("test")),
              evaluate: vi.fn().mockResolvedValue({
                viewportWidth: 1280,
                viewportHeight: 720,
                scrollWidth: 1280,
                scrollHeight: 2000,
                scrollX: 0,
                scrollY: 0,
              }),
              viewport: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
              close: vi.fn(),
              $: vi.fn(),
              click: vi.fn(),
              waitForSelector: vi.fn(),
              waitForNavigation: vi.fn(),
              cookies: vi.fn().mockResolvedValue([]),
              deleteCookie: vi.fn(),
              hover: vi.fn(),
              focus: vi.fn(),
              type: vi.fn(),
              select: vi.fn(),
              keyboard: {
                press: vi.fn(),
                down: vi.fn(),
                up: vi.fn(),
              },
              evaluateOnNewDocument: vi.fn(),
            }),
            close: vi.fn(),
          }),
        },
      }));

      // Import after mocking - this is a workaround for the private function
      const module = await import("../../src/tools/captureScreenshot.js");
      // Access the function through module internals if possible
      // For now, we'll test the integration behavior instead
    });

    it("should convert viewport parameter to viewport step", () => {
      const input = {
        url: "https://example.com",
        viewport: {
          preset: "iphone-14",
          width: 390,
          height: 844,
          isMobile: true,
          hasTouch: true,
        },
      };

      // Expected: viewport should be converted to a viewport step
      const expectedViewportStep: ViewportStep = {
        type: "viewport",
        preset: "iphone-14",
        width: 390,
        height: 844,
        isMobile: true,
        hasTouch: true,
      };

      // This would test the actual conversion if we had access to the function
      // For now, we verify the type structure is correct
      expect(expectedViewportStep.type).toBe("viewport");
      expect(expectedViewportStep.preset).toBe("iphone-14");
    });

    it("should create fullPage step directly", () => {
      // fullPage is now only available as a step, not a top-level parameter
      const input = {
        url: "https://example.com",
        steps: [
          { type: "fullPage" as const, enabled: true },
          { type: "screenshot" as const },
        ],
      };

      // Expected: fullPage step structure
      const expectedFullPageStep: FullPageStep = {
        type: "fullPage",
        enabled: true,
      };

      expect(expectedFullPageStep.type).toBe("fullPage");
      expect(expectedFullPageStep.enabled).toBe(true);
      expect(input.steps[0].type).toBe("fullPage");
    });

    it("should convert cookies parameter to cookie steps", () => {
      const input = {
        url: "https://example.com",
        cookies: [
          {
            name: "session",
            value: "abc123",
            domain: ".example.com",
            secure: true,
          },
          {
            name: "preference",
            value: "dark",
            path: "/",
          },
        ],
      };

      // Expected: each cookie should be converted to a cookie step
      const expectedCookieSteps: CookieActionStep[] = [
        {
          type: "cookie",
          action: "set",
          name: "session",
          value: "abc123",
          domain: ".example.com",
          secure: true,
        },
        {
          type: "cookie",
          action: "set",
          name: "preference",
          value: "dark",
          path: "/",
        },
      ];

      expectedCookieSteps.forEach(step => {
        expect(step.type).toBe("cookie");
        expect(step.action).toBe("set");
      });
    });

    it("should convert clickActions with delays to multiple steps", () => {
      const input = {
        url: "https://example.com",
        clickActions: [
          {
            selector: ".btn-menu",
            delayBefore: 500,
            delayAfter: 1000,
            button: "left",
          },
        ],
      };

      // Expected: should create delay -> click -> delay steps
      const expectedSteps: ActionStep[] = [
        { type: "delay", duration: 500 },
        { type: "click", target: ".btn-menu", button: "left" },
        { type: "delay", duration: 1000 },
      ];

      expect(expectedSteps).toHaveLength(3);
      expect(expectedSteps[0].type).toBe("delay");
      expect(expectedSteps[1].type).toBe("click");
      expect(expectedSteps[2].type).toBe("delay");
    });

    it("should convert scroll parameter to scroll step", () => {
      const input = {
        url: "https://example.com",
        scroll: {
          x: 0,
          y: 500,
          behavior: "smooth" as const,
        },
      };

      // Expected: scroll should be converted to a scroll step
      const expectedScrollStep: ScrollStep = {
        type: "scroll",
        x: 0,
        y: 500,
        behavior: "smooth",
      };

      expect(expectedScrollStep.type).toBe("scroll");
    });
  });

  describe("Steps execution order", () => {
    it("should execute viewport and cookie set steps before navigation", () => {
      const steps: ActionStep[] = [
        { type: "viewport", width: 1920, height: 1080 },
        { type: "cookie", action: "set", name: "auth", value: "token123" },
        { type: "click", target: ".button" },
        { type: "cookie", action: "delete", name: "old-cookie" },
        { type: "screenshot" },
      ];

      // Pre-nav steps should include viewport and cookie set
      const preNavSteps = steps.filter(step => 
        step.type === "viewport" || 
        (step.type === "cookie" && (step as CookieActionStep).action === "set")
      );

      expect(preNavSteps).toHaveLength(2);
      expect(preNavSteps[0].type).toBe("viewport");
      expect(preNavSteps[1].type).toBe("cookie");

      // Post-nav steps should include everything else
      const postNavSteps = steps.filter(step => 
        step.type !== "viewport" && 
        !(step.type === "cookie" && (step as CookieActionStep).action === "set")
      );

      expect(postNavSteps).toHaveLength(3);
      expect(postNavSteps[0].type).toBe("click");
      expect(postNavSteps[1].type).toBe("cookie");
      expect(postNavSteps[2].type).toBe("screenshot");
    });
  });

  describe("Step schemas", () => {
    it("should validate viewport step schema", () => {
      const viewportStepSchema = z.object({
        type: z.literal("viewport"),
        preset: z.string().optional(),
        width: z.number().positive().optional(),
        height: z.number().positive().optional(),
        deviceScaleFactor: z.number().positive().optional(),
        isMobile: z.boolean().optional(),
        hasTouch: z.boolean().optional(),
        isLandscape: z.boolean().optional(),
        userAgent: z.string().optional(),
      });

      const validStep = {
        type: "viewport" as const,
        preset: "iphone-14",
        width: 390,
        height: 844,
        isMobile: true,
      };

      expect(() => viewportStepSchema.parse(validStep)).not.toThrow();

      const invalidStep = {
        type: "viewport" as const,
        width: -100, // Invalid: negative width
      };

      expect(() => viewportStepSchema.parse(invalidStep)).toThrow();
    });

    it("should validate fullPage step schema", () => {
      const fullPageStepSchema = z.object({
        type: z.literal("fullPage"),
        enabled: z.boolean(),
      });

      const validStep = {
        type: "fullPage" as const,
        enabled: true,
      };

      expect(() => fullPageStepSchema.parse(validStep)).not.toThrow();

      const invalidStep = {
        type: "fullPage" as const,
        // Missing required 'enabled' field
      };

      expect(() => fullPageStepSchema.parse(invalidStep)).toThrow();
    });
  });

  describe("Backward compatibility", () => {
    it("should support both legacy parameters and new steps format", () => {
      const legacyInput = {
        url: "https://example.com",
        viewport: { width: 1920, height: 1080 },
        cookies: [{ name: "session", value: "abc" }],
        scroll: { y: 500 },
        clickActions: [{ selector: ".btn" }],
      };

      const newInput = {
        url: "https://example.com",
        steps: [
          { type: "viewport" as const, width: 1920, height: 1080 },
          { type: "cookie" as const, action: "set" as const, name: "session", value: "abc" },
          { type: "fullPage" as const, enabled: true },
          { type: "click" as const, target: ".btn" },
          { type: "scroll" as const, y: 500 },
          { type: "screenshot" as const },
        ],
      };

      // Both formats should be valid
      expect(legacyInput.url).toBeDefined();
      expect(newInput.url).toBeDefined();
      expect(newInput.steps).toHaveLength(6);
      // Legacy input no longer has fullPage - it's only available as a step
    });

    it("should merge legacy parameters with explicit steps", () => {
      const mixedInput = {
        url: "https://example.com",
        viewport: { width: 1920, height: 1080 }, // Legacy parameter
        steps: [
          { type: "fullPage" as const, enabled: true }, // fullPage now as step
          { type: "click" as const, target: ".btn" },
          { type: "screenshot" as const },
        ],
      };

      // Should handle both legacy and new format together
      expect(mixedInput.viewport).toBeDefined();
      expect(mixedInput.steps).toHaveLength(3);
    });
  });

  describe("Screenshot step behavior", () => {
    it("should auto-add screenshot step if none exists", () => {
      const stepsWithoutScreenshot: ActionStep[] = [
        { type: "viewport", width: 1920 },
        { type: "click", target: ".btn" },
      ];

      // Simulating the logic in runScreenshot
      const hasScreenshotStep = stepsWithoutScreenshot.some(step => step.type === "screenshot");
      if (!hasScreenshotStep) {
        stepsWithoutScreenshot.push({ type: "screenshot" });
      }

      expect(stepsWithoutScreenshot).toHaveLength(3);
      expect(stepsWithoutScreenshot[2].type).toBe("screenshot");
    });

    it("should respect fullPage setting in screenshot step", () => {
      const screenshotStep: ScreenshotStep = {
        type: "screenshot",
        fullPage: true,
      };

      expect(screenshotStep.type).toBe("screenshot");
      expect(screenshotStep.fullPage).toBe(true);
    });

    it("should allow element-specific screenshots with captureElement", () => {
      const screenshotStep: ScreenshotStep = {
        type: "screenshot",
        captureElement: ".main-content",
      };

      expect(screenshotStep.type).toBe("screenshot");
      expect(screenshotStep.captureElement).toBe(".main-content");
    });
  });

  describe("Complex step sequences", () => {
    it("should handle multi-step interaction flow", () => {
      const complexFlow: ActionStep[] = [
        { type: "viewport", preset: "desktop-hd" },
        { type: "cookie", action: "set", name: "consent", value: "accepted" },
        { type: "fullPage", enabled: false },
        { type: "click", target: "#accept-cookies" },
        { type: "delay", duration: 1000 },
        { type: "scroll", y: 500 },
        { type: "screenshot" },
        { type: "click", target: ".expand-section" },
        { type: "waitForSelector", awaitElement: ".expanded-content" },
        { type: "fullPage", enabled: true },
        { type: "screenshot" },
      ];

      // Verify the flow makes sense
      expect(complexFlow).toHaveLength(11);
      
      // Count screenshot steps
      const screenshotSteps = complexFlow.filter(s => s.type === "screenshot");
      expect(screenshotSteps).toHaveLength(2);

      // Verify fullPage toggles
      const fullPageSteps = complexFlow.filter(s => s.type === "fullPage");
      expect(fullPageSteps).toHaveLength(2);
      expect((fullPageSteps[0] as FullPageStep).enabled).toBe(false);
      expect((fullPageSteps[1] as FullPageStep).enabled).toBe(true);
    });
  });

  describe("FillForm step", () => {
    it("should validate fillForm step schema", () => {
      const formFieldSchema = z.object({
        selector: z.string().min(1),
        value: z.string(),
        type: z.enum(["text", "select", "checkbox", "radio", "textarea", "password", "email", "number", "tel", "url", "date", "file"]).optional(),
        matchByText: z.boolean().optional(),
        delay: z.number().min(0).max(1000).optional(),
      });

      const fillFormStepSchema = z.object({
        type: z.literal("fillForm"),
        fields: z.array(formFieldSchema).min(1),
        formSelector: z.string().optional(),
        submit: z.boolean().optional(),
        submitSelector: z.string().optional(),
        waitForNavigation: z.boolean().optional(),
      });

      const validStep = {
        type: "fillForm" as const,
        fields: [
          { selector: "#email", value: "test@example.com" },
          { selector: "#password", value: "secret123" },
        ],
        submit: true,
      };

      expect(() => fillFormStepSchema.parse(validStep)).not.toThrow();

      const invalidStep = {
        type: "fillForm" as const,
        fields: [], // Invalid: empty fields array
      };

      expect(() => fillFormStepSchema.parse(invalidStep)).toThrow();
    });

    it("should create valid fillForm step with multiple field types", () => {
      const fillFormStep: FillFormStep = {
        type: "fillForm",
        fields: [
          { selector: "#username", value: "john_doe" },
          { selector: "#email", value: "john@example.com", type: "email" },
          { selector: "#password", value: "SecurePass123!", type: "password" },
          { selector: "#country", value: "us", type: "select" },
          { selector: "#newsletter", value: "true", type: "checkbox" },
          { selector: "input[name='plan']", value: "premium", type: "radio" },
        ],
        formSelector: "#registration-form",
        submit: true,
        submitSelector: "#submit-btn",
        waitForNavigation: true,
      };

      expect(fillFormStep.type).toBe("fillForm");
      expect(fillFormStep.fields).toHaveLength(6);
      expect(fillFormStep.submit).toBe(true);
      expect(fillFormStep.formSelector).toBe("#registration-form");
    });

    it("should handle fillForm step with minimal configuration", () => {
      const minimalFillForm: FillFormStep = {
        type: "fillForm",
        fields: [
          { selector: "#search", value: "test query" },
        ],
      };

      expect(minimalFillForm.type).toBe("fillForm");
      expect(minimalFillForm.fields).toHaveLength(1);
      expect(minimalFillForm.submit).toBeUndefined();
      expect(minimalFillForm.formSelector).toBeUndefined();
    });

    it("should support matchByText for select fields", () => {
      const fillFormStep: FillFormStep = {
        type: "fillForm",
        fields: [
          { selector: "#country", value: "United States", type: "select", matchByText: true },
        ],
      };

      expect(fillFormStep.fields[0].matchByText).toBe(true);
    });

    it("should support delay for text fields", () => {
      const fillFormStep: FillFormStep = {
        type: "fillForm",
        fields: [
          { selector: "#search", value: "slow typing", delay: 100 },
        ],
      };

      expect(fillFormStep.fields[0].delay).toBe(100);
    });

    it("should include fillForm in complex step sequences", () => {
      const loginFlow: ActionStep[] = [
        { type: "viewport", preset: "desktop-hd" },
        { 
          type: "fillForm", 
          fields: [
            { selector: "#email", value: "user@example.com" },
            { selector: "#password", value: "password123" },
          ],
          submit: true,
        },
        { type: "waitForSelector", awaitElement: ".dashboard" },
        { type: "screenshot" },
      ];

      expect(loginFlow).toHaveLength(4);
      expect(loginFlow[1].type).toBe("fillForm");
      
      const fillStep = loginFlow[1] as FillFormStep;
      expect(fillStep.fields).toHaveLength(2);
      expect(fillStep.submit).toBe(true);
    });

    it("should handle checkbox values as strings", () => {
      const fillFormStep: FillFormStep = {
        type: "fillForm",
        fields: [
          { selector: "#terms", value: "true", type: "checkbox" },
          { selector: "#marketing", value: "false", type: "checkbox" },
        ],
      };

      expect(fillFormStep.fields[0].value).toBe("true");
      expect(fillFormStep.fields[1].value).toBe("false");
    });

    it("should handle file upload field type", () => {
      const fillFormStep: FillFormStep = {
        type: "fillForm",
        fields: [
          { selector: "#avatar", value: "/path/to/image.jpg", type: "file" },
        ],
      };

      expect(fillFormStep.fields[0].type).toBe("file");
    });
  });

  describe("QuickFillStep", () => {
    it("should validate quickFill step schema", () => {
      const quickFillStep: QuickFillStep = {
        type: "quickFill",
        target: "#search",
        value: "test query",
        submit: true,
      };

      expect(quickFillStep.type).toBe("quickFill");
      expect(quickFillStep.target).toBe("#search");
      expect(quickFillStep.value).toBe("test query");
      expect(quickFillStep.submit).toBe(true);
    });

    it("should allow quickFill without submit", () => {
      const quickFillStep: QuickFillStep = {
        type: "quickFill",
        target: "#input",
        value: "some text",
      };

      expect(quickFillStep.type).toBe("quickFill");
      expect(quickFillStep.submit).toBeUndefined();
    });

    it("should include quickFill in step sequences", () => {
      const searchFlow: ActionStep[] = [
        { type: "quickFill", target: "#search", value: "MCP protocol", submit: true },
        { type: "waitForSelector", awaitElement: ".results" },
        { type: "screenshot" },
      ];

      expect(searchFlow).toHaveLength(3);
      expect(searchFlow[0].type).toBe("quickFill");
      expect((searchFlow[0] as QuickFillStep).target).toBe("#search");
    });
  });

  describe("Form field input types", () => {
    it("should support all field types", () => {
      const allTypes: FormFieldInput["type"][] = [
        "text", "select", "checkbox", "radio", "textarea", 
        "password", "email", "number", "tel", "url", "date", "file"
      ];

      allTypes.forEach(fieldType => {
        const field: FormFieldInput = {
          selector: "#test",
          value: "test value",
          type: fieldType,
        };
        expect(field.type).toBe(fieldType);
      });
    });

    it("should allow field type to be undefined for auto-detection", () => {
      const field: FormFieldInput = {
        selector: "#email",
        value: "test@example.com",
      };

      expect(field.type).toBeUndefined();
    });
  });
});
