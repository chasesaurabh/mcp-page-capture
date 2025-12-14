/**
 * Input normalization utilities for LLM-friendly parameter handling
 */

/**
 * Device name aliases for common terms.
 * Maps to the reduced LLM-optimized preset list.
 */
const DEVICE_ALIASES: Record<string, string> = {
  // Generic terms (recommended for LLMs)
  "mobile": "iphone-16-pro",
  "phone": "iphone-16-pro",
  "smartphone": "iphone-16-pro",
  "tablet": "ipad-pro",
  "desktop": "desktop-fhd",
  "laptop": "macbook-pro-16",
  "pc": "desktop-fhd",
  
  // Apple variations
  "iphone": "iphone-16-pro",
  "iphone16": "iphone-16-pro",
  "iphone 16": "iphone-16-pro",
  "iphone-16-pro": "iphone-16-pro",
  "iphone14": "iphone-14",
  "iphone 14": "iphone-14",
  "ipad": "ipad-pro",
  "ipadpro": "ipad-pro",
  "ipad pro": "ipad-pro",
  "ipad-air": "ipad-air",
  "macbook": "macbook-pro-16",
  "macbook-air": "macbook-air",
  
  // Android variations
  "android": "pixel-9",
  "pixel": "pixel-9",
  "pixel9": "pixel-9",
  "pixel 9": "pixel-9",
  "samsung": "galaxy-s24",
  "galaxy": "galaxy-s24",
  
  // Desktop variations
  "hd": "desktop-hd",
  "fullhd": "desktop-fhd",
  "full-hd": "desktop-fhd",
  "fhd": "desktop-fhd",
  "1080p": "desktop-fhd",
  "4k": "desktop-4k",
  "uhd": "desktop-4k",
  
  // Common typos
  "iphon-16": "iphone-16-pro",
  "ipone-16": "iphone-16-pro",
  "andriod": "pixel-9",
  "pixle": "pixel-9",
};

/**
 * Legacy parameter names that should trigger deprecation warnings.
 */
export const LEGACY_PARAMS: Record<string, { canonical: string; message: string }> = {
  "selector": { canonical: "target", message: "Use 'target' instead of 'selector'" },
  "awaitElement": { canonical: "for", message: "Use 'for' instead of 'awaitElement'" },
  "scrollTo": { canonical: "to", message: "Use 'to' instead of 'scrollTo'" },
  "waitAfter": { canonical: "waitFor", message: "Use 'waitFor' instead of 'waitAfter'" },
  "waitForSelector": { canonical: "waitFor", message: "Use 'waitFor' instead of 'waitForSelector'" },
  "captureElement": { canonical: "element", message: "Use 'element' instead of 'captureElement'" },
  "preset": { canonical: "device", message: "Use 'device' instead of 'preset'" },
};

/**
 * Tracks deprecation warnings for a request.
 */
export interface DeprecationWarnings {
  warnings: string[];
  hasWarnings: boolean;
}

/**
 * Check step for legacy parameters and collect warnings.
 */
export function collectDeprecationWarnings(steps: any[]): DeprecationWarnings {
  const warnings: string[] = [];
  
  if (!steps || steps.length === 0) {
    return { warnings, hasWarnings: false };
  }
  
  steps.forEach((step, index) => {
    for (const [legacy, info] of Object.entries(LEGACY_PARAMS)) {
      if (step[legacy] !== undefined) {
        warnings.push(`Step ${index + 1}: ${info.message}`);
      }
    }
    
    // Check for deprecated step types
    if (step.type === "waitForSelector") {
      warnings.push(`Step ${index + 1}: Use 'wait' step instead of 'waitForSelector'`);
    }
    if (step.type === "delay") {
      warnings.push(`Step ${index + 1}: Use 'wait' step with 'for' selector instead of 'delay' when possible`);
    }
    if (step.type === "quickFill") {
      warnings.push(`Step ${index + 1}: Use 'fill' step instead of 'quickFill'`);
    }
    if (step.type === "fillForm") {
      warnings.push(`Step ${index + 1}: Use multiple 'fill' steps instead of 'fillForm'`);
    }
    if (step.type === "fullPage") {
      warnings.push(`Step ${index + 1}: Use 'screenshot' step with 'fullPage: true' instead`);
    }
  });
  
  return { warnings, hasWarnings: warnings.length > 0 };
}

/**
 * Normalize device name to a known preset
 */
export function normalizeDeviceName(device: string): string {
  const normalized = device.toLowerCase().trim().replace(/\s+/g, " ");
  return DEVICE_ALIASES[normalized] || normalized;
}

/**
 * URL normalization with common fixes
 */
export function normalizeUrlInput(url: string): string {
  let normalized = url.trim();
  
  // Fix common typos first
  normalized = normalized
    .replace(/^http:\/\/http/i, "http")
    .replace(/^https:\/\/https/i, "https")
    .replace(/^htps:\/\//i, "https://")
    .replace(/^htp:\/\//i, "http://");
  
  // Add protocol if missing
  if (!normalized.match(/^https?:\/\//i)) {
    normalized = `https://${normalized}`;
  }
  
  return normalized;
}

/**
 * Selector normalization with auto-fix suggestions
 */
export function normalizeSelector(selector: string): { 
  normalized: string; 
  wasFixed: boolean; 
  suggestion?: string;
} {
  const trimmed = selector.trim();
  
  // Check for bare word that looks like ID or class
  if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(trimmed) && !isValidTagName(trimmed)) {
    // Likely missing # or .
    // Try to infer based on common patterns
    if (trimmed.includes("btn") || trimmed.includes("button") || trimmed.includes("submit")) {
      return { 
        normalized: `.${trimmed}`, 
        wasFixed: true,
        suggestion: `Interpreted "${trimmed}" as class selector ".${trimmed}". Use "#${trimmed}" if it's an ID.`,
      };
    }
    // Default to ID for single words (more specific)
    return { 
      normalized: `#${trimmed}`, 
      wasFixed: true,
      suggestion: `Interpreted "${trimmed}" as ID selector "#${trimmed}". Use ".${trimmed}" if it's a class.`,
    };
  }
  
  return { normalized: trimmed, wasFixed: false };
}

/**
 * Value normalization for fill steps
 */
export function normalizeFillValue(value: string, target?: string): string {
  const trimmed = value.trim();
  
  // Boolean normalization for checkboxes
  if (["true", "yes", "1", "on", "checked"].includes(trimmed.toLowerCase())) {
    return "true";
  }
  if (["false", "no", "0", "off", "unchecked"].includes(trimmed.toLowerCase())) {
    return "false";
  }
  
  return trimmed;
}

/**
 * Validate CSS selector syntax
 */
export function validateSelector(selector: string): { valid: boolean; error?: string } {
  // Check for empty selector
  if (!selector || selector.trim() === "") {
    return { valid: false, error: "Selector cannot be empty" };
  }

  // Check for obviously invalid patterns
  if (selector.startsWith('##') || selector.startsWith('..')) {
    return { valid: false, error: "Invalid selector: double prefix" };
  }

  // Check for common mistakes - bare words without prefixes
  const bareWord = /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(selector);
  
  // If it's a bare word, check if it's a valid HTML tag
  if (bareWord && !isValidTagName(selector)) {
    return { 
      valid: false, 
      error: `"${selector}" looks like an ID or class. Did you mean "#${selector}" (ID) or ".${selector}" (class)?` 
    };
  }

  // Check for unclosed brackets first (before other validation)
  const openBrackets = (selector.match(/\[/g) || []).length;
  const closeBrackets = (selector.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    return { valid: false, error: "Unclosed brackets in selector" };
  }

  // Check for unclosed parentheses
  const openParens = (selector.match(/\(/g) || []).length;
  const closeParens = (selector.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    return { valid: false, error: "Unclosed parentheses in selector" };
  }

  // Try to validate as CSS selector (basic validation)
  try {
    // Check for obviously invalid patterns
    if (selector.includes("::") && !isValidPseudoElement(selector)) {
      return { valid: false, error: "Invalid pseudo-element in selector" };
    }
    
    if (selector.includes(":") && !isValidPseudoClass(selector)) {
      return { valid: false, error: "Invalid pseudo-class in selector" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid CSS selector syntax" };
  }
}

/**
 * Check if a string is a valid HTML tag name
 */
function isValidTagName(tag: string): boolean {
  const validTags = [
    "a", "abbr", "address", "area", "article", "aside", "audio",
    "b", "base", "bdi", "bdo", "blockquote", "body", "br", "button",
    "canvas", "caption", "cite", "code", "col", "colgroup",
    "data", "datalist", "dd", "del", "details", "dfn", "dialog", "div", "dl", "dt",
    "em", "embed",
    "fieldset", "figcaption", "figure", "footer", "form",
    "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html",
    "i", "iframe", "img", "input", "ins",
    "kbd",
    "label", "legend", "li", "link",
    "main", "map", "mark", "menu", "meta", "meter",
    "nav", "noscript",
    "object", "ol", "optgroup", "option", "output",
    "p", "param", "picture", "pre", "progress",
    "q",
    "rp", "rt", "ruby",
    "s", "samp", "script", "section", "select", "slot", "small", "source", "span",
    "strong", "style", "sub", "summary", "sup", "svg",
    "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time",
    "title", "tr", "track",
    "u", "ul",
    "var", "video",
    "wbr"
  ];
  return validTags.includes(tag.toLowerCase());
}

/**
 * Check if selector contains valid pseudo-elements
 */
function isValidPseudoElement(selector: string): boolean {
  const validPseudoElements = ["::before", "::after", "::first-letter", "::first-line", "::selection", "::backdrop"];
  return validPseudoElements.some(pe => selector.includes(pe));
}

/**
 * Check if selector contains valid pseudo-classes
 */
function isValidPseudoClass(selector: string): boolean {
  const validPseudoClasses = [
    ":hover", ":active", ":focus", ":visited", ":link",
    ":first-child", ":last-child", ":nth-child", ":nth-of-type",
    ":not", ":is", ":where", ":has",
    ":checked", ":disabled", ":enabled",
    ":empty", ":target", ":root"
  ];
  return validPseudoClasses.some(pc => selector.includes(pc.split("(")[0]));
}

/**
 * Normalizes step parameters to canonical names
 */
export function normalizeStepParams(step: any): any {
  const normalized = { ...step };
  
  // Apply parameter normalization based on step type
  switch (step.type) {
    case "click":
      if (step.selector && !step.target) normalized.target = step.selector;
      // Normalize all wait variants to waitFor (new canonical name)
      if (step.wait && !step.waitFor) normalized.waitFor = step.wait;
      if (step.waitAfter && !step.waitFor) normalized.waitFor = step.waitAfter;
      if (step.waitForSelector && !step.waitFor) normalized.waitFor = step.waitForSelector;
      delete normalized.selector;
      delete normalized.wait;
      delete normalized.waitAfter;
      delete normalized.waitForSelector;
      break;
      
    case "wait":
    case "waitForSelector":
      if (step.awaitElement && !step.for) normalized.for = step.awaitElement;
      if (step.selector && !step.for) normalized.for = step.selector;
      if (step.waitFor && !step.for) normalized.for = step.waitFor;
      normalized.type = "wait"; // Normalize type too
      delete normalized.awaitElement;
      delete normalized.selector;
      delete normalized.waitFor;
      break;
      
    case "scroll":
      if (step.scrollTo && !step.to) normalized.to = step.scrollTo;
      if (step.selector && !step.to) normalized.to = step.selector;
      delete normalized.scrollTo;
      delete normalized.selector;
      break;
      
    case "screenshot":
      if (step.captureElement && !step.element) normalized.element = step.captureElement;
      delete normalized.captureElement;
      break;
      
    case "viewport":
      if (step.preset && !step.device) normalized.device = step.preset;
      delete normalized.preset;
      break;
      
    case "fill":
    case "text":
    case "type":
    case "hover":
      if (step.selector && !step.target) normalized.target = step.selector;
      if (step.text && !step.value) normalized.value = step.text;
      normalized.type = "fill"; // Normalize type
      delete normalized.selector;
      delete normalized.text;
      break;
  }
  
  return normalized;
}

/**
 * Normalizes all steps in array
 */
export function normalizeAllSteps(steps: any[]): any[] {
  if (!steps || steps.length === 0) return steps;
  
  // 1. Normalize parameter names
  let normalized = steps.map(normalizeStepParams);
  
  // 2. Move viewport to first position if present
  const viewportIndex = normalized.findIndex(s => s.type === "viewport");
  if (viewportIndex > 0) {
    const [viewportStep] = normalized.splice(viewportIndex, 1);
    normalized.unshift(viewportStep);
  }
  
  // 3. Ensure screenshot at end if not present
  const hasScreenshot = normalized.some(s => s.type === "screenshot");
  if (!hasScreenshot) {
    normalized.push({ type: "screenshot" });
  }
  
  return normalized;
}

/**
 * Normalize and reorder steps array (legacy function, kept for compatibility)
 */
export function normalizeSteps(steps: any[]): any[] {
  return normalizeAllSteps(steps);
}

/**
 * Auto-fix common parameter issues
 */
export function autoFixParameters(params: any): any {
  const fixed = { ...params };

  // Normalize device name if present
  if (fixed.device) {
    fixed.device = normalizeDeviceName(fixed.device);
  }

  // Normalize steps if present
  if (fixed.steps) {
    fixed.steps = normalizeSteps(fixed.steps);
    
    // Auto-fix step parameters
    fixed.steps = fixed.steps.map((step: any) => {
      const fixedStep = { ...step };

      // Fix common naming mistakes
      if (step.selector && !step.target) {
        fixedStep.target = step.selector;
        delete fixedStep.selector;
      }

      if (step.awaitElement && !step.for) {
        fixedStep.for = step.awaitElement;
        delete fixedStep.awaitElement;
      }

      if (step.scrollTo && !step.to) {
        fixedStep.to = step.scrollTo;
        delete fixedStep.scrollTo;
      }

      if (step.captureElement && !step.element) {
        fixedStep.element = step.captureElement;
        delete fixedStep.captureElement;
      }

      if (step.timeout && !step.duration) {
        fixedStep.duration = step.timeout;
        delete fixedStep.timeout;
      }

      return fixedStep;
    });
  }

  return fixed;
}

/**
 * Convert simple top-level parameters to steps
 */
export function convertSimpleParamsToSteps(params: any): any[] {
  const steps: any[] = [];

  // Convert device parameter to viewport step
  if (params.device) {
    steps.push({
      type: "viewport",
      device: normalizeDeviceName(params.device)
    });
  }

  // Convert waitFor parameter to wait step
  if (params.waitFor) {
    steps.push({
      type: "wait",
      for: params.waitFor
    });
  }

  // Convert fullPage parameter to screenshot step
  if (params.fullPage !== undefined) {
    steps.push({
      type: "screenshot",
      fullPage: params.fullPage
    });
  }

  return steps;
}

/**
 * Merge legacy parameters into steps
 */
export function mergeLegacyIntoSteps(params: any, existingSteps: any[] = []): any[] {
  const steps = [...existingSteps];

  // Convert viewport config to viewport step (if not already present)
  if (params.viewport && !steps.some(s => s.type === "viewport")) {
    steps.unshift({
      type: "viewport",
      ...params.viewport
    });
  }

  // Convert cookies to cookie steps
  if (params.cookies && Array.isArray(params.cookies)) {
    const cookieSteps = params.cookies.map((cookie: any) => ({
      type: "cookie",
      action: "set",
      ...cookie
    }));
    // Add cookie steps at the beginning (after viewport if present)
    const viewportIndex = steps.findIndex(s => s.type === "viewport");
    steps.splice(viewportIndex + 1, 0, ...cookieSteps);
  }

  // Convert scroll config to scroll step
  if (params.scroll && !steps.some(s => s.type === "scroll")) {
    steps.push({
      type: "scroll",
      ...params.scroll
    });
  }

  // Convert clickActions to click steps
  if (params.clickActions && Array.isArray(params.clickActions)) {
    const clickSteps = params.clickActions.map((action: any) => ({
      type: "click",
      target: action.selector,
      ...action
    }));
    steps.push(...clickSteps);
  }

  return steps;
}
