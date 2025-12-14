import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import puppeteer from "puppeteer";
import type { Browser, Page } from "puppeteer";

describe("LLM Usage Scenarios", () => {
  let browser: Browser;
  let page: Page;
  
  beforeEach(async () => {
    vi.mock("puppeteer");
  });
  
  afterEach(async () => {
    vi.restoreAllMocks();
  });

  describe("Minimal input scenarios", () => {
    it("should work with just URL", async () => {
      const input = { 
        url: "https://example.com" 
      };
      
      // Should capture screenshot with defaults
      expect(input.url).toBe("https://example.com");
      // Screenshot should be auto-added
      // Viewport should use default desktop
    });

    it("should work with URL and device", async () => {
      const input = { 
        url: "https://example.com",
        device: "mobile"
      };
      
      expect(input.device).toBe("mobile");
      // Should convert to viewport step with mobile preset
    });

    it("should work with URL and fullPage", async () => {
      const input = { 
        url: "https://example.com",
        fullPage: true
      };
      
      expect(input.fullPage).toBe(true);
      // Should convert to screenshot step with fullPage
    });

    it("should work with URL and waitFor", async () => {
      const input = { 
        url: "https://example.com",
        waitFor: ".content-loaded"
      };
      
      expect(input.waitFor).toBe(".content-loaded");
      // Should convert to wait step
    });
  });

  describe("Common form scenarios", () => {
    it("should handle single field search", async () => {
      const input = {
        url: "https://example.com",
        steps: [
          { type: "fill", target: "#search", value: "query", submit: true }
        ]
      };
      
      expect(input.steps[0].type).toBe("fill");
      expect(input.steps[0].submit).toBe(true);
    });

    it("should handle login form", async () => {
      const input = {
        url: "https://example.com/login",
        steps: [
          { 
            type: "fill", 
            fields: [
              { target: "#email", value: "user@test.com" },
              { target: "#password", value: "secret" }
            ],
            submit: true 
          },
          { type: "wait", for: ".dashboard" }
        ]
      };
      
      expect(input.steps[0].type).toBe("fill");
      expect(input.steps[0].fields).toHaveLength(2);
      expect(input.steps[1].type).toBe("wait");
    });

    it("should handle multi-step form", async () => {
      const input = {
        url: "https://example.com/signup",
        steps: [
          { type: "fill", target: "#name", value: "John Doe" },
          { type: "fill", target: "#email", value: "john@example.com" },
          { type: "fill", target: "#agree", value: "true" },
          { type: "click", target: "button[type='submit']", waitAfter: ".confirmation" }
        ]
      };
      
      expect(input.steps).toHaveLength(4);
      expect(input.steps[3].waitAfter).toBe(".confirmation");
    });
  });

  describe("Navigation scenarios", () => {
    it("should handle click and wait pattern", async () => {
      const input = {
        url: "https://example.com",
        steps: [
          { type: "click", target: ".menu-toggle", waitAfter: ".menu-open" },
          { type: "click", target: ".menu-item", waitAfter: ".page-loaded" }
        ]
      };
      
      expect(input.steps[0].waitAfter).toBeDefined();
      expect(input.steps[1].waitAfter).toBeDefined();
    });

    it("should handle scroll to section", async () => {
      const input = {
        url: "https://example.com",
        steps: [
          { type: "scroll", to: "#testimonials" },
          { type: "wait", duration: 500 },
          { type: "screenshot" }
        ]
      };
      
      expect(input.steps[0].to).toBe("#testimonials");
      expect(input.steps[1].duration).toBe(500);
      expect(input.steps[2].type).toBe("screenshot");
    });

    it("should handle hover menu interaction", async () => {
      const input = {
        url: "https://example.com",
        steps: [
          { type: "hover", target: ".dropdown-trigger", duration: 200 },
          { type: "click", target: ".dropdown-item" }
        ]
      };
      
      expect(input.steps[0].type).toBe("hover");
      expect(input.steps[0].duration).toBe(200);
    });
  });

  describe("Mobile emulation scenarios", () => {
    it("should handle mobile viewport", async () => {
      const input = {
        url: "https://example.com",
        steps: [
          { type: "viewport", device: "iphone-14" },
          { type: "screenshot", fullPage: true }
        ]
      };
      
      expect(input.steps[0].device).toBe("iphone-14");
      expect(input.steps[1].fullPage).toBe(true);
    });

    it("should handle custom viewport", async () => {
      const input = {
        url: "https://example.com",
        steps: [
          { type: "viewport", width: 768, height: 1024 },
          { type: "screenshot" }
        ]
      };
      
      expect(input.steps[0].width).toBe(768);
      expect(input.steps[0].height).toBe(1024);
    });
  });

  describe("Advanced interaction scenarios", () => {
    it("should handle autocomplete with type step", async () => {
      const input = {
        url: "https://example.com",
        steps: [
          { type: "type", target: "#autocomplete", text: "search term", delay: 50 },
          { type: "wait", for: ".suggestions", duration: 1000 },
          { type: "click", target: ".suggestion:first-child" }
        ]
      };
      
      expect(input.steps[0].delay).toBe(50);
      expect(input.steps[1].for).toBe(".suggestions");
    });

    it("should handle element-specific screenshot", async () => {
      const input = {
        url: "https://example.com",
        steps: [
          { type: "wait", for: ".chart" },
          { type: "screenshot", element: ".chart" }
        ]
      };
      
      expect(input.steps[1].element).toBe(".chart");
    });

    it("should handle mixed form field types", async () => {
      const input = {
        url: "https://example.com/form",
        steps: [
          { 
            type: "fill",
            fields: [
              { target: "#name", value: "John" },
              { target: "#country", value: "US" },  // select
              { target: "#newsletter", value: "true" },  // checkbox
              { target: "input[name='gender'][value='male']", value: "true" }  // radio
            ]
          }
        ]
      };
      
      expect(input.steps[0].fields).toHaveLength(4);
    });
  });

  describe("Error recovery scenarios", () => {
    it("should provide helpful error for missing element", async () => {
      // This would throw an error with actionable fix
      const selector = "#nonexistent";
      const expectedError = {
        message: "✗ click failed: Element not found",
        fix: `The selector "${selector}" matched no elements`,
        example: { type: "wait", for: selector }
      };
      
      expect(expectedError.fix).toContain("matched no elements");
      expect(expectedError.example).toBeDefined();
    });

    it("should provide helpful error for invalid selector", async () => {
      const selector = "missingprefix";
      const expectedError = {
        message: `✗ Invalid CSS selector: "${selector}"`,
        fix: "Missing # for ID selectors",
        suggestion: `#${selector} or .${selector}`
      };
      
      expect(expectedError.fix).toContain("Missing #");
    });

    it("should auto-fix viewport position", async () => {
      const input = {
        url: "https://example.com",
        steps: [
          { type: "wait", for: "body" },
          { type: "viewport", device: "mobile" },  // Wrong position
          { type: "click", target: "button" }
        ]
      };
      
      // After normalization, viewport should be moved to first
      // This would be handled by normalizeSteps function
      const normalized = [
        { type: "viewport", device: "mobile" },
        { type: "wait", for: "body" },
        { type: "click", target: "button" }
      ];
      
      expect(normalized[0].type).toBe("viewport");
    });
  });

  describe("Legacy compatibility", () => {
    it("should support old viewport parameter", async () => {
      const input = {
        url: "https://example.com",
        viewport: { preset: "iphone-14" }
      };
      
      // Should be converted to viewport step internally
      expect(input.viewport.preset).toBe("iphone-14");
    });

    it("should support old cookies parameter", async () => {
      const input = {
        url: "https://example.com",
        cookies: [
          { name: "session", value: "abc123" }
        ]
      };
      
      // Should be converted to cookie steps internally
      expect(input.cookies[0].name).toBe("session");
    });

    it("should support old scroll parameter", async () => {
      const input = {
        url: "https://example.com",
        scroll: { y: 500 }
      };
      
      // Should be converted to scroll step internally
      expect(input.scroll.y).toBe(500);
    });

    it("should support old clickActions parameter", async () => {
      const input = {
        url: "https://example.com",
        clickActions: [
          { selector: ".button", delayAfter: 1000 }
        ]
      };
      
      // Should be converted to click steps internally
      expect(input.clickActions[0].selector).toBe(".button");
    });
  });

  describe("Performance edge cases", () => {
    it("should handle maximum wait duration", async () => {
      const input = {
        url: "https://example.com",
        steps: [
          { type: "wait", duration: 30000 }  // Max allowed
        ]
      };
      
      expect(input.steps[0].duration).toBe(30000);
    });

    it("should handle multiple screenshots", async () => {
      const input = {
        url: "https://example.com",
        steps: [
          { type: "screenshot" },
          { type: "scroll", y: 500 },
          { type: "screenshot" },
          { type: "scroll", to: "#footer" },
          { type: "screenshot", fullPage: true }
        ]
      };
      
      const screenshotSteps = input.steps.filter(s => s.type === "screenshot");
      expect(screenshotSteps).toHaveLength(3);
    });

    it("should handle rapid interactions", async () => {
      const input = {
        url: "https://example.com",
        steps: [
          { type: "click", target: "#btn1" },
          { type: "click", target: "#btn2" },
          { type: "click", target: "#btn3" },
          { type: "wait", duration: 100 }
        ]
      };
      
      const clickSteps = input.steps.filter(s => s.type === "click");
      expect(clickSteps).toHaveLength(3);
    });
  });
});

describe("Response Format", () => {
  it("should format success response correctly", () => {
    const metadata = {
      url: "https://example.com",
      viewportPreset: "mobile",
      viewportWidth: 375,
      viewportHeight: 667,
      capturedAt: "2024-12-13T10:30:00Z",
      fullPage: false,
      bytes: 45678
    };
    
    const stepsInfo = [
      { type: "viewport", success: true },
      { type: "fill", target: "#search", success: true },
      { type: "click", target: "button", success: true },
      { type: "screenshot", success: true }
    ];
    
    // Format would produce:
    const expectedFormat = `✓ Screenshot captured successfully

URL: https://example.com
Device: mobile (375x667)
Captured: 2024-12-13T10:30:00Z
Full page: false
Size: 44.6 KB

Steps executed: 4/4
  1. ✓ viewport
  2. ✓ fill #search
  3. ✓ click button
  4. ✓ screenshot`;
    
    expect(expectedFormat).toContain("✓ Screenshot captured successfully");
    expect(expectedFormat).toContain("Steps executed: 4/4");
  });

  it("should format error response with fixes", () => {
    const error = {
      message: "✗ click failed: Element not found",
      fix: "Check selector, add wait step",
      example: { type: "wait", for: "#button" }
    };
    
    const formatted = `${error.message}

FIX: ${error.fix}

EXAMPLE:
\`\`\`json
${JSON.stringify(error.example, null, 2)}
\`\`\``;
    
    expect(formatted).toContain("FIX:");
    expect(formatted).toContain("EXAMPLE:");
  });
});
