export interface StepOrderValidation {
  valid: boolean;
  reordered: boolean;
  steps: any[];
  warnings: string[];
  errors: string[];
  suggestions: StepSuggestion[];
}

export interface StepSuggestion {
  stepIndex: number;
  issue: string;
  fix: string;
  correctedStep?: any;
}

export interface ValidateResult {
  valid: boolean;
  stepCount: number;
  estimatedTimeMs: number;
  warnings: string[];
  errors: string[];
  suggestions: StepSuggestion[];
  stepAnalysis: StepAnalysis[];
}

export interface StepAnalysis {
  index: number;
  type: string;
  target?: string;
  status: "ok" | "warning" | "error";
  notes: string[];
}

/**
 * Format step order warnings for LLM-friendly response
 */
export function formatStepOrderWarnings(validation: StepOrderValidation): string | null {
  if (validation.warnings.length === 0 && validation.errors.length === 0) {
    return null;
  }
  const lines: string[] = [];
  if (validation.errors.length > 0) {
    lines.push("ERRORS:");
    lines.push(...validation.errors.map(e => `  ✗ ${e}`));
  }
  if (validation.warnings.length > 0) {
    lines.push("WARNINGS:");
    lines.push(...validation.warnings.map(w => `  ⚠ ${w}`));
  }
  return lines.join('\n');
}

/**
 * Format validation result for MCP response
 */
export function formatValidateResult(result: ValidateResult): string {
  const lines: string[] = [];
  
  lines.push(`VALIDATION ${result.valid ? "PASSED ✓" : "FAILED ✗"}`);
  lines.push(`Steps: ${result.stepCount} | Estimated time: ${result.estimatedTimeMs}ms`);
  lines.push("");
  
  if (result.errors.length > 0) {
    lines.push("ERRORS:");
    result.errors.forEach(e => lines.push(`  ✗ ${e}`));
    lines.push("");
  }
  
  if (result.warnings.length > 0) {
    lines.push("WARNINGS:");
    result.warnings.forEach(w => lines.push(`  ⚠ ${w}`));
    lines.push("");
  }
  
  if (result.suggestions.length > 0) {
    lines.push("SUGGESTIONS:");
    result.suggestions.forEach(s => {
      lines.push(`  Step ${s.stepIndex + 1}: ${s.issue}`);
      lines.push(`    → ${s.fix}`);
    });
    lines.push("");
  }
  
  lines.push("STEP ANALYSIS:");
  result.stepAnalysis.forEach(s => {
    const icon = s.status === "ok" ? "✓" : s.status === "warning" ? "⚠" : "✗";
    const target = s.target ? ` (${s.target})` : "";
    lines.push(`  ${s.index + 1}. ${icon} ${s.type}${target}`);
    s.notes.forEach(n => lines.push(`       ${n}`));
  });
  
  return lines.join('\n');
}

/**
 * Perform full validation of steps (for validate mode)
 */
export function performStepValidation(steps: any[], url: string): ValidateResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const suggestions: StepSuggestion[] = [];
  const stepAnalysis: StepAnalysis[] = [];
  
  // Estimate time (rough): 1s per step + 2s base navigation
  const estimatedTimeMs = 2000 + (steps?.length || 0) * 1000;
  
  if (!steps || steps.length === 0) {
    stepAnalysis.push({
      index: 0,
      type: "screenshot",
      status: "ok",
      notes: ["Auto-added screenshot step"]
    });
    return {
      valid: true,
      stepCount: 1,
      estimatedTimeMs,
      warnings: [],
      errors: [],
      suggestions: [],
      stepAnalysis
    };
  }
  
  // Analyze each step
  steps.forEach((step, i) => {
    const analysis: StepAnalysis = {
      index: i,
      type: step.type,
      target: step.target || step.for || step.to || step.element,
      status: "ok",
      notes: []
    };
    
    // Check viewport position
    if (step.type === "viewport" && i > 0) {
      analysis.status = "warning";
      analysis.notes.push("Should be first step (will be auto-moved)");
      warnings.push(`Viewport at step ${i + 1} will be moved to first position`);
    }
    
    // Check wait step has either selector or duration
    if (step.type === "wait" && !step.for && !step.duration) {
      analysis.status = "error";
      analysis.notes.push("Missing 'for' (selector) or 'duration' (ms)");
      errors.push(`Step ${i + 1}: wait step requires 'for' (selector) or 'duration' (ms)`);
      suggestions.push({
        stepIndex: i,
        issue: "wait step missing condition",
        fix: "Add 'for' parameter with CSS selector, or 'duration' for fixed wait",
        correctedStep: { type: "wait", for: ".your-element", timeout: 10000 }
      });
    }
    
    // Suggest using 'for' over 'duration' when possible
    if (step.type === "wait" && step.duration && !step.for) {
      analysis.status = "warning";
      analysis.notes.push("Fixed duration wait - prefer 'for' with selector when possible");
    }
    
    // Check fill step has target and value
    if (step.type === "fill") {
      if (!step.target) {
        analysis.status = "error";
        analysis.notes.push("Missing 'target' parameter");
        errors.push(`Step ${i + 1}: fill step requires 'target' parameter`);
      }
      if (step.value === undefined) {
        analysis.status = "error";
        analysis.notes.push("Missing 'value' parameter");
        errors.push(`Step ${i + 1}: fill step requires 'value' parameter`);
      }
    }
    
    // Check click step has target
    if (step.type === "click" && !step.target) {
      analysis.status = "error";
      analysis.notes.push("Missing 'target' parameter");
      errors.push(`Step ${i + 1}: click step requires 'target' parameter`);
    }
    
    // Suggest waitFor for click followed by action
    if (step.type === "click" && !step.waitFor) {
      const nextStep = steps[i + 1];
      if (nextStep && !["wait", "screenshot"].includes(nextStep.type)) {
        analysis.status = "warning";
        analysis.notes.push("Consider adding 'waitFor' if click loads dynamic content");
        suggestions.push({
          stepIndex: i,
          issue: "Click may need waitFor",
          fix: "Add 'waitFor' parameter if click loads dynamic content",
          correctedStep: { ...step, waitFor: ".expected-element" }
        });
      }
    }
    
    // Check screenshot position
    if (step.type === "screenshot" && i < steps.length - 1) {
      const hasActionsAfter = steps.slice(i + 1).some(s => 
        !["wait", "delay"].includes(s.type)
      );
      if (hasActionsAfter) {
        analysis.status = "warning";
        analysis.notes.push("Actions after screenshot will not be captured");
        warnings.push(`Screenshot at step ${i + 1} is not last - subsequent actions won't be captured`);
      }
    }
    
    stepAnalysis.push(analysis);
  });
  
  // Check if screenshot is present
  const hasScreenshot = steps.some(s => s.type === "screenshot");
  if (!hasScreenshot) {
    stepAnalysis.push({
      index: steps.length,
      type: "screenshot",
      status: "ok",
      notes: ["Auto-added at end"]
    });
  }
  
  return {
    valid: errors.length === 0,
    stepCount: hasScreenshot ? steps.length : steps.length + 1,
    estimatedTimeMs,
    warnings,
    errors,
    suggestions,
    stepAnalysis
  };
}

/**
 * Validates and fixes step ordering
 */
export function validateStepOrder(steps: any[]): StepOrderValidation {
  if (!steps || steps.length === 0) {
    return { valid: true, reordered: false, steps: [], warnings: [], errors: [], suggestions: [] };
  }
  
  const warnings: string[] = [];
  const errors: string[] = [];
  const suggestions: StepSuggestion[] = [];
  let reordered = false;
  const orderedSteps = [...steps];
  
  // Rule 1: viewport must be first
  const viewportIndex = orderedSteps.findIndex(s => s.type === "viewport");
  if (viewportIndex > 0) {
    const [viewportStep] = orderedSteps.splice(viewportIndex, 1);
    orderedSteps.unshift(viewportStep);
    warnings.push("Viewport step moved to first position (required for correct rendering)");
    reordered = true;
  }
  
  // Rule 2: screenshot should be last (if explicit)
  const screenshotIndex = orderedSteps.findIndex(s => s.type === "screenshot");
  if (screenshotIndex !== -1 && screenshotIndex !== orderedSteps.length - 1) {
    const stepsAfterScreenshot = orderedSteps.slice(screenshotIndex + 1);
    const hasActionAfter = stepsAfterScreenshot.some(s => 
      !["wait", "delay"].includes(s.type)
    );
    if (hasActionAfter) {
      warnings.push("Actions after screenshot step will not be captured in the image");
    }
  }
  
  // Rule 3: wait steps should come before the action they're waiting for
  for (let i = 0; i < orderedSteps.length - 1; i++) {
    const current = orderedSteps[i];
    const next = orderedSteps[i + 1];
    
    if (["click", "fill"].includes(current.type) && 
        next.type === "wait" && 
        next.for === current.target) {
      suggestions.push({
        stepIndex: i + 1,
        issue: `Wait for "${next.for}" should come before ${current.type}`,
        fix: `Move wait step before the ${current.type} step for reliability`
      });
    }
  }

  // Rule 4: Check for click without waitFor on dynamic pages
  for (let i = 0; i < orderedSteps.length; i++) {
    const step = orderedSteps[i];
    if (step.type === "click" && !step.waitFor && !step.wait && !step.waitForNavigation) {
      const nextStep = orderedSteps[i + 1];
      if (nextStep && nextStep.type !== "wait" && nextStep.type !== "screenshot") {
        suggestions.push({
          stepIndex: i,
          issue: `Click on "${step.target}" may load dynamic content`,
          fix: "Add 'waitFor' parameter to wait for content after click",
          correctedStep: { ...step, waitFor: ".expected-result" }
        });
      }
    }
  }
  
  // Rule 5: Check for fill without preceding wait on dynamic pages
  for (let i = 0; i < orderedSteps.length; i++) {
    const step = orderedSteps[i];
    if (step.type === "fill" && i === 0) {
      const prevStep = orderedSteps[i - 1];
      if (!prevStep || (prevStep.type !== "wait" && prevStep.type !== "viewport")) {
        suggestions.push({
          stepIndex: i,
          issue: `Fill on "${step.target}" may fail if element not loaded`,
          fix: "Consider adding wait step before fill for dynamic pages"
        });
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    reordered,
    steps: orderedSteps,
    warnings,
    errors,
    suggestions,
  };
}
