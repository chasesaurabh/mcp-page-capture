/**
 * Parameter Normalization for LLM-Friendly MCP Tools
 * 
 * CANONICAL PARAMETER NAMES (6 primary step types):
 * - target: Element to interact with (fill, click)
 * - for: Element to wait for (wait)
 * - to: Element to scroll to (scroll)
 * - device: Viewport preset (viewport)
 * - element: Element to capture (screenshot)
 * - wait: Element to wait for after action (click)
 * 
 * DEPRECATED PARAMETERS (logged as warnings):
 * - selector → target
 * - awaitElement → for
 * - scrollTo → to
 * - preset → device
 * - captureElement → element
 * - waitAfter/waitForSelector → wait
 */

// Track deprecation warnings (avoid spam)
const deprecationWarnings = new Set<string>();

function logDeprecation(oldParam: string, newParam: string, stepType?: string): void {
  const key = `${stepType || 'step'}.${oldParam}`;
  if (!deprecationWarnings.has(key)) {
    deprecationWarnings.add(key);
    console.warn(`[mcp-page-capture] DEPRECATED: '${oldParam}' → use '${newParam}' instead${stepType ? ` in ${stepType} step` : ''}`);
  }
}

/**
 * Normalizes legacy/alternate parameter names to canonical names.
 * Logs deprecation warnings for legacy parameters.
 */
export function normalizeStepParameters(step: Record<string, any>): Record<string, any> {
  const normalized = { ...step };
  
  // Target aliases (canonical: 'target')
  if (normalized.selector) {
    if (!normalized.target) {
      logDeprecation('selector', 'target', normalized.type);
      normalized.target = normalized.selector;
    }
    delete normalized.selector;
  }
  
  // Wait aliases (canonical: 'for')
  if (normalized.awaitElement && !normalized.for) {
    logDeprecation('awaitElement', 'for', normalized.type);
    normalized.for = normalized.awaitElement;
    delete normalized.awaitElement;
  }
  
  // Scroll aliases (canonical: 'to')
  if (normalized.scrollTo && !normalized.to) {
    logDeprecation('scrollTo', 'to', 'scroll');
    normalized.to = normalized.scrollTo;
    delete normalized.scrollTo;
  }
  
  // Post-action wait aliases (canonical: 'wait')
  if (normalized.waitAfter && !normalized.wait) {
    logDeprecation('waitAfter', 'wait', 'click');
    normalized.wait = normalized.waitAfter;
    delete normalized.waitAfter;
  }
  if (normalized.waitForSelector && !normalized.wait) {
    logDeprecation('waitForSelector', 'wait', 'click');
    normalized.wait = normalized.waitForSelector;
    delete normalized.waitForSelector;
  }
  
  // Screenshot element aliases (canonical: 'element')
  if (normalized.captureElement && !normalized.element) {
    logDeprecation('captureElement', 'element', 'screenshot');
    normalized.element = normalized.captureElement;
    delete normalized.captureElement;
  }
  
  // Device aliases (canonical: 'device')
  if (normalized.preset && !normalized.device) {
    logDeprecation('preset', 'device', 'viewport');
    normalized.device = normalized.preset;
    delete normalized.preset;
  }
  
  // Legacy step type normalization
  if (normalized.type === "waitForSelector") {
    logDeprecation('waitForSelector', 'wait', 'step type');
    normalized.type = "wait";
    if (normalized.awaitElement && !normalized.for) {
      normalized.for = normalized.awaitElement;
      delete normalized.awaitElement;
    }
  }
  
  if (normalized.type === "delay") {
    logDeprecation('delay', 'wait', 'step type');
    normalized.type = "wait";
  }
  
  if (normalized.type === "quickFill") {
    logDeprecation('quickFill', 'fill', 'step type');
    normalized.type = "fill";
  }
  
  if (normalized.type === "fillForm") {
    logDeprecation('fillForm', 'fill (use multiple fill steps)', 'step type');
    // Keep as fillForm for runtime compatibility, but warn
  }
  
  return normalized;
}

/**
 * Normalize all steps in an array
 */
export function normalizeAllSteps(steps: Record<string, any>[]): Record<string, any>[] {
  return steps.map(normalizeStepParameters);
}

/**
 * Clear deprecation warning cache (for testing)
 */
export function clearDeprecationWarnings(): void {
  deprecationWarnings.clear();
}
