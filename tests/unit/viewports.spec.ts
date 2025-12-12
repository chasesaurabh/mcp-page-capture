import { describe, it, expect } from "vitest";
import { 
  getViewportPreset, 
  listViewportPresets, 
  mergeViewportOptions,
  VIEWPORT_PRESETS 
} from "../../src/config/viewports.js";

describe("viewport configuration", () => {
  describe("VIEWPORT_PRESETS", () => {
    it("should have desktop presets", () => {
      expect(VIEWPORT_PRESETS["desktop-fhd"]).toBeDefined();
      expect(VIEWPORT_PRESETS["desktop-hd"]).toBeDefined();
      expect(VIEWPORT_PRESETS["desktop-4k"]).toBeDefined();
      expect(VIEWPORT_PRESETS["macbook-pro-16"]).toBeDefined();
    });

    it("should have tablet presets", () => {
      expect(VIEWPORT_PRESETS["ipad-pro-13"]).toBeDefined();
      expect(VIEWPORT_PRESETS["ipad-pro-13-landscape"]).toBeDefined();
      expect(VIEWPORT_PRESETS["ipad-10"]).toBeDefined();
      expect(VIEWPORT_PRESETS["surface-pro"]).toBeDefined();
      expect(VIEWPORT_PRESETS["galaxy-tab-s9-ultra"]).toBeDefined();
    });

    it("should have mobile presets", () => {
      expect(VIEWPORT_PRESETS["iphone-16-pro-max"]).toBeDefined();
      expect(VIEWPORT_PRESETS["iphone-16-pro"]).toBeDefined();
      expect(VIEWPORT_PRESETS["iphone-se"]).toBeDefined();
      expect(VIEWPORT_PRESETS["pixel-9-pro"]).toBeDefined();
      expect(VIEWPORT_PRESETS["galaxy-s24-ultra"]).toBeDefined();
    });

    it("should have correct desktop viewport dimensions", () => {
      const desktopFhd = VIEWPORT_PRESETS["desktop-fhd"].preset;
      expect(desktopFhd.width).toBe(1920);
      expect(desktopFhd.height).toBe(1080);
      expect(desktopFhd.isMobile).toBe(false);
      expect(desktopFhd.hasTouch).toBe(false);
    });

    it("should have correct mobile viewport properties", () => {
      const iPhone16Pro = VIEWPORT_PRESETS["iphone-16-pro"].preset;
      expect(iPhone16Pro.width).toBe(402);
      expect(iPhone16Pro.height).toBe(874);
      expect(iPhone16Pro.deviceScaleFactor).toBe(3);
      expect(iPhone16Pro.isMobile).toBe(true);
      expect(iPhone16Pro.hasTouch).toBe(true);
      expect(iPhone16Pro.userAgent).toContain("iPhone");
    });

    it("should have correct tablet viewport properties", () => {
      const iPadPro13 = VIEWPORT_PRESETS["ipad-pro-13"].preset;
      expect(iPadPro13.width).toBe(1032);
      expect(iPadPro13.height).toBe(1376);
      expect(iPadPro13.deviceScaleFactor).toBe(2);
      expect(iPadPro13.isMobile).toBe(true);
      expect(iPadPro13.hasTouch).toBe(true);
      expect(iPadPro13.userAgent).toContain("iPad");
    });

    it("should have landscape variant for iPad Pro", () => {
      const iPadPro13Landscape = VIEWPORT_PRESETS["ipad-pro-13-landscape"].preset;
      expect(iPadPro13Landscape.width).toBe(1376);
      expect(iPadPro13Landscape.height).toBe(1032);
      expect(iPadPro13Landscape.isLandscape).toBe(true);
    });
  });

  describe("getViewportPreset", () => {
    it("should return preset for valid name", () => {
      const preset = getViewportPreset("desktop-fhd");
      expect(preset).toBeDefined();
      expect(preset?.width).toBe(1920);
      expect(preset?.height).toBe(1080);
    });

    it("should return undefined for invalid name", () => {
      const preset = getViewportPreset("non-existent");
      expect(preset).toBeUndefined();
    });

    it("should return mobile preset with user agent", () => {
      const preset = getViewportPreset("iphone-16-pro-max");
      expect(preset).toBeDefined();
      expect(preset?.userAgent).toContain("iPhone");
      expect(preset?.userAgent).toContain("Safari");
    });

    it("should return Android preset with correct user agent", () => {
      const preset = getViewportPreset("pixel-9-pro");
      expect(preset).toBeDefined();
      expect(preset?.userAgent).toContain("Android");
      expect(preset?.userAgent).toContain("Chrome");
    });
  });

  describe("listViewportPresets", () => {
    it("should return all preset names", () => {
      const presetNames = listViewportPresets();
      expect(presetNames).toBeInstanceOf(Array);
      expect(presetNames.length).toBeGreaterThan(0);
      expect(presetNames).toContain("desktop-fhd");
      expect(presetNames).toContain("iphone-16-pro");
      expect(presetNames).toContain("ipad-pro-13");
    });

    it("should match VIEWPORT_PRESETS keys", () => {
      const presetNames = listViewportPresets();
      const expectedNames = Object.keys(VIEWPORT_PRESETS);
      expect(presetNames).toEqual(expectedNames);
    });
  });

  describe("mergeViewportOptions", () => {
    it("should merge overrides with preset", () => {
      const preset = {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      };
      
      const overrides = {
        width: 1600,
        deviceScaleFactor: 2,
      };
      
      const result = mergeViewportOptions(preset, overrides);
      
      expect(result.width).toBe(1600);
      expect(result.height).toBe(1080);
      expect(result.deviceScaleFactor).toBe(2);
      expect(result.isMobile).toBe(false);
      expect(result.hasTouch).toBe(false);
    });

    it("should handle undefined overrides", () => {
      const preset = {
        width: 1920,
        height: 1080,
      };
      
      const result = mergeViewportOptions(preset, undefined);
      
      expect(result).toEqual(preset);
    });

    it("should handle partial overrides", () => {
      const preset = {
        width: 1920,
        height: 1080,
        isMobile: false,
        hasTouch: false,
        userAgent: "Desktop Browser",
      };
      
      const overrides = {
        isMobile: true,
        hasTouch: true,
      };
      
      const result = mergeViewportOptions(preset, overrides);
      
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.isMobile).toBe(true);
      expect(result.hasTouch).toBe(true);
      expect(result.userAgent).toBe("Desktop Browser");
    });

    it("should override user agent", () => {
      const preset = {
        width: 400,
        height: 800,
        userAgent: "Old User Agent",
      };
      
      const overrides = {
        userAgent: "Custom User Agent",
      };
      
      const result = mergeViewportOptions(preset, overrides);
      
      expect(result.userAgent).toBe("Custom User Agent");
    });
  });

  describe("viewport profiles", () => {
    it("should have consistent structure", () => {
      Object.values(VIEWPORT_PRESETS).forEach(profile => {
        expect(profile).toHaveProperty("name");
        expect(profile).toHaveProperty("description");
        expect(profile).toHaveProperty("preset");
        expect(profile.preset).toHaveProperty("width");
        expect(profile.preset).toHaveProperty("height");
      });
    });

    it("should have reasonable dimensions", () => {
      Object.values(VIEWPORT_PRESETS).forEach(profile => {
        expect(profile.preset.width).toBeGreaterThan(0);
        expect(profile.preset.height).toBeGreaterThan(0);
        expect(profile.preset.width).toBeLessThanOrEqual(3840); // 4K max width
        expect(profile.preset.height).toBeLessThanOrEqual(2960); // Tablet portrait max height (Galaxy Tab S9 Ultra)
      });
    });

    it("should have device scale factor for high DPI devices", () => {
      const highDpiDevices = [
        "desktop-4k",
        "macbook-pro-16",
        "ipad-pro-13",
        "ipad-10",
        "iphone-16-pro-max",
        "iphone-16-pro",
        "pixel-9-pro",
        "galaxy-s24-ultra",
      ];
      
      highDpiDevices.forEach(device => {
        const preset = VIEWPORT_PRESETS[device]?.preset;
        expect(preset?.deviceScaleFactor).toBeGreaterThanOrEqual(2);
      });
    });
  });
});
