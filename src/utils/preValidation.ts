export interface PreValidationResult {
  valid: boolean;
  canProceed: boolean;
  corrections: StepCorrection[];
  warnings: string[];
  errors: string[];
  correctedSteps?: any[];
}

export interface StepCorrection {
  step: number;
  original: any;
  corrected: any;
  reason: string;
}

/**
 * Pre-validates steps before execution and applies automatic corrections
 */
export function preValidateSteps(steps: any[], url: string): PreValidationResult {
  const corrections: StepCorrection[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  
  let correctedSteps = [...steps];
  
  // 1. Move viewport to first position
  const viewportIndex = correctedSteps.findIndex(s => s.type === "viewport");
  if (viewportIndex > 0) {
    const viewport = correctedSteps.splice(viewportIndex, 1)[0];
    correctedSteps.unshift(viewport);
    corrections.push({
      step: viewportIndex + 1,
      original: { position: viewportIndex + 1 },
      corrected: { position: 1 },
      reason: "viewport must be first step for correct rendering",
    });
  }
  
  // 2. Check for wait-before-action pattern
  for (let i = 0; i < correctedSteps.length; i++) {
    const step = correctedSteps[i];
    const prevStep = correctedSteps[i - 1];
    
    if (["click", "fill"].includes(step.type)) {
      const hasWaitBefore = prevStep?.type === "wait" && prevStep.for === step.target;
      if (!hasWaitBefore && !isStaticSelector(step.target)) {
        warnings.push(
          `Step ${i + 1}: Consider adding { "type": "wait", "for": "${step.target}" } ` +
          `before ${step.type} for dynamic pages`
        );
      }
    }
  }
  
  // 3. Validate selectors
  for (let i = 0; i < correctedSteps.length; i++) {
    const step = correctedSteps[i];
    const target = step.target || step.for || step.to;
    
    if (target !== undefined && typeof target === "string") {
      const selectorResult = validateSelector(target);
      if (!selectorResult.valid) {
        errors.push(`Step ${i + 1}: Invalid selector "${target}" - ${selectorResult.error}`);
      } else if (selectorResult.suggestion) {
        corrections.push({
          step: i + 1,
          original: { target },
          corrected: { target: selectorResult.normalized },
          reason: selectorResult.suggestion,
        });
        // Apply correction
        if (step.target !== undefined) correctedSteps[i].target = selectorResult.normalized;
        if (step.for !== undefined) correctedSteps[i].for = selectorResult.normalized;
        if (step.to !== undefined) correctedSteps[i].to = selectorResult.normalized;
      }
    }
  }
  
  // 4. Check for unreachable steps after screenshot
  const screenshotIndex = correctedSteps.findIndex(s => s.type === "screenshot");
  if (screenshotIndex !== -1 && screenshotIndex < correctedSteps.length - 1) {
    const stepsAfter = correctedSteps.slice(screenshotIndex + 1);
    const actionStepsAfter = stepsAfter.filter(s => !["wait", "delay"].includes(s.type));
    if (actionStepsAfter.length > 0) {
      warnings.push(
        `Steps after screenshot (${actionStepsAfter.map(s => s.type).join(", ")}) ` +
        `will execute but won't be captured`
      );
    }
  }
  
  return {
    valid: errors.length === 0,
    canProceed: errors.length === 0,
    corrections,
    warnings,
    errors,
    correctedSteps: corrections.length > 0 ? correctedSteps : undefined,
  };
}

function isStaticSelector(selector: string): boolean {
  // Selectors that typically exist immediately (no dynamic loading)
  return /^(body|html|head|#[a-z][a-z0-9-]*|input|button|form)$/i.test(selector);
}

function validateSelector(selector: string): { valid: boolean; error?: string; suggestion?: string; normalized?: string } {
  // Basic validation - check if it's a valid CSS selector
  if (!selector || selector.trim().length === 0) {
    return { valid: false, error: "Selector cannot be empty" };
  }
  
  // Check for common mistakes
  const trimmed = selector.trim();
  if (trimmed !== selector) {
    return { 
      valid: true, 
      suggestion: "Removed leading/trailing whitespace",
      normalized: trimmed 
    };
  }
  
  // Basic syntax validation (without DOM)
  // Check for obviously invalid patterns
  if (selector.includes('  ') || selector.startsWith(' ') || selector.endsWith(' ')) {
    return {
      valid: true,
      suggestion: "Removed extra whitespace",
      normalized: selector.replace(/\s+/g, ' ').trim()
    };
  }
  
  return { valid: true };
}
