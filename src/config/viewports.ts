import type { Viewport } from "puppeteer";

export interface ViewportPreset extends Viewport {
  userAgent?: string;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
  isLandscape?: boolean;
}

export interface ViewportProfile {
  name: string;
  description: string;
  preset: ViewportPreset;
}

export const VIEWPORT_PRESETS: Record<string, ViewportProfile> = {
  // Desktop presets
  "desktop-fhd": {
    name: "Desktop FHD",
    description: "Standard 1920x1080 desktop display",
    preset: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    },
  },
  "desktop-hd": {
    name: "Desktop HD",
    description: "Standard 1280x720 desktop display",
    preset: {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    },
  },
  "desktop-4k": {
    name: "Desktop 4K",
    description: "4K desktop display",
    preset: {
      width: 3840,
      height: 2160,
      deviceScaleFactor: 2,
      isMobile: false,
      hasTouch: false,
    },
  },
  "macbook-pro-16": {
    name: "MacBook Pro 16",
    description: "MacBook Pro 16-inch Retina display (M3/M4)",
    preset: {
      width: 3456,
      height: 2234,
      deviceScaleFactor: 2,
      isMobile: false,
      hasTouch: false,
    },
  },
  "macbook-air-15": {
    name: "MacBook Air 15",
    description: "MacBook Air 15-inch Retina display (M3)",
    preset: {
      width: 2880,
      height: 1864,
      deviceScaleFactor: 2,
      isMobile: false,
      hasTouch: false,
    },
  },

  // Apple Tablet presets
  "ipad-pro-13": {
    name: "iPad Pro 13",
    description: "iPad Pro 13-inch M4 (2024)",
    preset: {
      width: 1032,
      height: 1376,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
  },
  "ipad-pro-13-landscape": {
    name: "iPad Pro 13 Landscape",
    description: "iPad Pro 13-inch M4 in landscape",
    preset: {
      width: 1376,
      height: 1032,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      isLandscape: true,
      userAgent:
        "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
  },
  "ipad-pro-11": {
    name: "iPad Pro 11",
    description: "iPad Pro 11-inch M4 (2024)",
    preset: {
      width: 834,
      height: 1194,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
  },
  "ipad-air-13": {
    name: "iPad Air 13",
    description: "iPad Air 13-inch M2 (2024)",
    preset: {
      width: 1024,
      height: 1366,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
  },
  "ipad-air-11": {
    name: "iPad Air 11",
    description: "iPad Air 11-inch M2 (2024)",
    preset: {
      width: 820,
      height: 1180,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
  },
  "ipad-10": {
    name: "iPad 10th Gen",
    description: "iPad 10th generation (2022)",
    preset: {
      width: 820,
      height: 1180,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
  },
  "ipad-mini-7": {
    name: "iPad mini 7",
    description: "iPad mini 7th generation A17 Pro (2024)",
    preset: {
      width: 744,
      height: 1133,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
  },

  // Samsung Tablet presets
  "galaxy-tab-s9-ultra": {
    name: "Galaxy Tab S9 Ultra",
    description: "Samsung Galaxy Tab S9 Ultra 14.6-inch",
    preset: {
      width: 1848,
      height: 2960,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
  },
  "galaxy-tab-s9": {
    name: "Galaxy Tab S9",
    description: "Samsung Galaxy Tab S9 11-inch",
    preset: {
      width: 1600,
      height: 2560,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
  },

  // Other Tablet presets
  "surface-pro": {
    name: "Surface Pro",
    description: "Microsoft Surface Pro 11th Edition",
    preset: {
      width: 912,
      height: 1368,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
    },
  },

  // Apple iPhone presets (iPhone 16 series - 2024)
  "iphone-16-pro-max": {
    name: "iPhone 16 Pro Max",
    description: "iPhone 16 Pro Max (2024)",
    preset: {
      width: 440,
      height: 956,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
  },
  "iphone-16-pro": {
    name: "iPhone 16 Pro",
    description: "iPhone 16 Pro (2024)",
    preset: {
      width: 402,
      height: 874,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
  },
  "iphone-16-plus": {
    name: "iPhone 16 Plus",
    description: "iPhone 16 Plus (2024)",
    preset: {
      width: 430,
      height: 932,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
  },
  "iphone-16": {
    name: "iPhone 16",
    description: "iPhone 16 (2024)",
    preset: {
      width: 393,
      height: 852,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
  },
  // Apple iPhone presets (iPhone 15 series - 2023, still current)
  "iphone-15-pro-max": {
    name: "iPhone 15 Pro Max",
    description: "iPhone 15 Pro Max (2023)",
    preset: {
      width: 430,
      height: 932,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
  },
  "iphone-15-pro": {
    name: "iPhone 15 Pro",
    description: "iPhone 15 Pro (2023)",
    preset: {
      width: 393,
      height: 852,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
  },
  "iphone-15": {
    name: "iPhone 15",
    description: "iPhone 15 (2023)",
    preset: {
      width: 393,
      height: 852,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
  },
  "iphone-se": {
    name: "iPhone SE",
    description: "iPhone SE 4th generation (2025)",
    preset: {
      width: 393,
      height: 852,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
  },

  // Google Pixel presets (Pixel 9 series - 2024)
  "pixel-9-pro-xl": {
    name: "Pixel 9 Pro XL",
    description: "Google Pixel 9 Pro XL (2024)",
    preset: {
      width: 412,
      height: 915,
      deviceScaleFactor: 3.5,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    },
  },
  "pixel-9-pro": {
    name: "Pixel 9 Pro",
    description: "Google Pixel 9 Pro (2024)",
    preset: {
      width: 412,
      height: 892,
      deviceScaleFactor: 3.5,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    },
  },
  "pixel-9": {
    name: "Pixel 9",
    description: "Google Pixel 9 (2024)",
    preset: {
      width: 412,
      height: 892,
      deviceScaleFactor: 2.75,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    },
  },
  "pixel-9-pro-fold": {
    name: "Pixel 9 Pro Fold",
    description: "Google Pixel 9 Pro Fold (2024)",
    preset: {
      width: 414,
      height: 906,
      deviceScaleFactor: 2.75,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro Fold) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    },
  },
  // Google Pixel presets (Pixel 8 series - 2023, still current)
  "pixel-8-pro": {
    name: "Pixel 8 Pro",
    description: "Google Pixel 8 Pro (2023)",
    preset: {
      width: 412,
      height: 892,
      deviceScaleFactor: 3.5,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    },
  },
  "pixel-8": {
    name: "Pixel 8",
    description: "Google Pixel 8 (2023)",
    preset: {
      width: 412,
      height: 892,
      deviceScaleFactor: 2.75,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    },
  },
  "pixel-8a": {
    name: "Pixel 8a",
    description: "Google Pixel 8a (2024)",
    preset: {
      width: 412,
      height: 892,
      deviceScaleFactor: 2.75,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; Pixel 8a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    },
  },

  // Samsung Galaxy S series (S24 - 2024)
  "galaxy-s24-ultra": {
    name: "Galaxy S24 Ultra",
    description: "Samsung Galaxy S24 Ultra (2024)",
    preset: {
      width: 412,
      height: 915,
      deviceScaleFactor: 3.5,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    },
  },
  "galaxy-s24-plus": {
    name: "Galaxy S24+",
    description: "Samsung Galaxy S24+ (2024)",
    preset: {
      width: 412,
      height: 915,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; SM-S926B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    },
  },
  "galaxy-s24": {
    name: "Galaxy S24",
    description: "Samsung Galaxy S24 (2024)",
    preset: {
      width: 412,
      height: 892,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    },
  },

  // Samsung Galaxy Z series (Foldables - 2024)
  "galaxy-z-fold-6": {
    name: "Galaxy Z Fold 6",
    description: "Samsung Galaxy Z Fold 6 (2024)",
    preset: {
      width: 412,
      height: 915,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; SM-F956B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    },
  },
  "galaxy-z-fold-6-inner": {
    name: "Galaxy Z Fold 6 Inner",
    description: "Samsung Galaxy Z Fold 6 inner display (2024)",
    preset: {
      width: 968,
      height: 1058,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; SM-F956B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    },
  },
  "galaxy-z-flip-6": {
    name: "Galaxy Z Flip 6",
    description: "Samsung Galaxy Z Flip 6 (2024)",
    preset: {
      width: 412,
      height: 915,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; SM-F741B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    },
  },

  // Samsung Galaxy A series (Mid-range - widely used)
  "galaxy-a55": {
    name: "Galaxy A55",
    description: "Samsung Galaxy A55 5G (2024)",
    preset: {
      width: 412,
      height: 915,
      deviceScaleFactor: 2.625,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; SM-A556B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    },
  },
  "galaxy-a35": {
    name: "Galaxy A35",
    description: "Samsung Galaxy A35 5G (2024)",
    preset: {
      width: 412,
      height: 915,
      deviceScaleFactor: 2.625,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; SM-A356B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    },
  },
};

/**
 * Device aliases mapping generic/short names to actual presets.
 * These allow LLMs to use simple names like "mobile" instead of specific device names.
 */
export const DEVICE_ALIASES: Record<string, string> = {
  // Generic aliases (map to latest devices)
  "mobile": "iphone-16-pro",
  "tablet": "ipad-pro-13",
  "desktop": "desktop-fhd",
  // Shorthand aliases
  "ipad-pro": "ipad-pro-13",
  "ipad-air": "ipad-air-13",
  "macbook-air": "macbook-air-15",
  "iphone-14": "iphone-15",  // Map to closest current model
  "pixel-9": "pixel-9",
  "galaxy-s24": "galaxy-s24",
  // Legacy aliases (for backward compatibility)
  "phone": "iphone-16-pro",
  "smartphone": "iphone-16-pro",
  "laptop": "macbook-pro-16",
  "iphone": "iphone-16-pro",
  "ipad": "ipad-pro-13",
  "pixel": "pixel-9",
  "galaxy": "galaxy-s24",
  "android": "pixel-9",
};

/**
 * Get viewport preset by name, supporting aliases.
 * Returns undefined if preset not found.
 */
export function getViewportPreset(name: string): ViewportPreset | undefined {
  const normalizedName = name.toLowerCase().trim();
  // Check for alias first
  const resolvedName = DEVICE_ALIASES[normalizedName] || normalizedName;
  return VIEWPORT_PRESETS[resolvedName]?.preset;
}

/**
 * List all available viewport preset names.
 * Includes both actual presets and aliases.
 */
export function listViewportPresets(): string[] {
  return Object.keys(VIEWPORT_PRESETS);
}

/**
 * List recommended device presets for LLM usage (top 15).
 */
export function listRecommendedPresets(): string[] {
  return [
    "mobile", "tablet", "desktop",
    "iphone-16-pro", "iphone-14", "pixel-9", "galaxy-s24",
    "ipad-pro", "ipad-air", "surface-pro",
    "desktop-fhd", "desktop-hd", "desktop-4k",
    "macbook-pro-16", "macbook-air"
  ];
}

export function mergeViewportOptions(preset: ViewportPreset, overrides?: Partial<ViewportPreset>): ViewportPreset {
  return { ...preset, ...overrides };
}
