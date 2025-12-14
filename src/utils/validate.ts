import { normalizeSelector, normalizeDeviceName, normalizeFillValue } from "./normalize.js";

export interface ValidationResult {
  valid: boolean;
  fixed: boolean;
  data: any;
  warnings: string[];
  errors: string[];
}

/**
 * Validates and auto-fixes steps array before execution
 */
export function validateAndFixSteps(steps: any[]): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  let fixed = false;
  
  const fixedSteps = steps.map((step, index) => {
    const fixedStep = { ...step };
    
    // Validate and fix selectors
    if (step.target) {
      const selectorResult = normalizeSelector(step.target);
      if (selectorResult.wasFixed) {
        fixedStep.target = selectorResult.normalized;
        warnings.push(`Step ${index + 1}: ${selectorResult.suggestion}`);
        fixed = true;
      }
    }
    
    if (step.for) {
      const selectorResult = normalizeSelector(step.for);
      if (selectorResult.wasFixed) {
        fixedStep.for = selectorResult.normalized;
        warnings.push(`Step ${index + 1}: ${selectorResult.suggestion}`);
        fixed = true;
      }
    }
    
    if (step.to && typeof step.to === "string") {
      const selectorResult = normalizeSelector(step.to);
      if (selectorResult.wasFixed) {
        fixedStep.to = selectorResult.normalized;
        warnings.push(`Step ${index + 1}: ${selectorResult.suggestion}`);
        fixed = true;
      }
    }
    
    // Validate and fix device names
    if (step.device) {
      const normalizedDevice = normalizeDeviceName(step.device);
      if (normalizedDevice !== step.device.toLowerCase()) {
        fixedStep.device = normalizedDevice;
        warnings.push(`Step ${index + 1}: Device "${step.device}" normalized to "${normalizedDevice}"`);
        fixed = true;
      }
    }
    
    // Validate and fix fill values
    if (step.type === "fill" && step.value !== undefined) {
      const normalizedValue = normalizeFillValue(step.value, step.target);
      if (normalizedValue !== step.value) {
        fixedStep.value = normalizedValue;
        fixed = true;
      }
    }
    
    // Validate wait duration
    if (step.type === "wait" && step.duration !== undefined) {
      if (step.duration > 30000) {
        fixedStep.duration = 30000;
        warnings.push(`Step ${index + 1}: Wait duration capped at 30000ms (was ${step.duration}ms)`);
        fixed = true;
      }
      if (step.duration < 0) {
        fixedStep.duration = 0;
        warnings.push(`Step ${index + 1}: Negative wait duration set to 0`);
        fixed = true;
      }
    }
    
    return fixedStep;
  });
  
  return {
    valid: errors.length === 0,
    fixed,
    data: fixedSteps,
    warnings,
    errors,
  };
}
