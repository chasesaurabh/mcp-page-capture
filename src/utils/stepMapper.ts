/**
 * Runtime step type (more permissive than LLM schema)
 */
type RuntimeStep = {
  type: string;
  [key: string]: any;
};

/**
 * Maps any step type to its canonical step type
 * This allows runtime to accept legacy formats while LLM only sees 6 types
 * Note: Returns RuntimeStep not LLMStep since some mappings include legacy fields
 */
export function mapToCanonicalStep(step: any): RuntimeStep {
  switch (step.type) {
    // Map to 'fill'
    case "fillForm":
      // Convert fillForm with fields array to sequence of fill steps
      // Handle in caller by returning array
      return { type: "fill", target: step.fields?.[0]?.selector, value: step.fields?.[0]?.value };
    case "quickFill":
      return { type: "fill", target: step.target, value: step.value, submit: step.submit };
    case "text":
      return { type: "fill", target: step.selector || step.target, value: step.value || step.text };
    case "type":
      return { type: "fill", target: step.selector || step.target, value: step.text || step.value };
    case "select":
      return { type: "fill", target: step.selector || step.target, value: step.value || step.text };
    case "checkbox":
      return { type: "fill", target: step.selector || step.target, value: String(step.checked ?? step.value) };
    case "radio":
      return { type: "fill", target: step.selector || step.target, value: step.value };
    
    // Map to 'wait'
    case "waitForSelector":
      return { type: "wait", for: step.awaitElement || step.selector || step.for };
    case "delay":
      return { type: "wait", duration: step.duration || step.ms };
    
    // Map to 'click'
    case "click":
      return { 
        type: "click", 
        target: step.target || step.selector,
        wait: step.waitAfter || step.waitForSelector || step.wait,
      };
    case "submit":
      return { type: "click", target: step.selector || step.target || 'button[type="submit"]' };
    
    // Map to 'scroll'
    case "scroll":
      return { 
        type: "scroll", 
        to: step.to || step.scrollTo || step.selector,
        y: step.y,
      };
    
    // Map to 'screenshot'
    case "screenshot":
    case "fullPage":
      return { 
        type: "screenshot", 
        fullPage: step.fullPage ?? step.enabled ?? (step.type === "fullPage"),
        element: step.element || step.captureElement || step.selector,
      };
    
    // Map to 'viewport'
    case "viewport":
      return {
        type: "viewport",
        device: step.device || step.preset,
        width: step.width,
        height: step.height,
      };
    
    // Pass through canonical types unchanged
    case "fill":
    case "wait":
      return step as RuntimeStep;
    
    default:
      // For truly advanced steps (hover, focus, blur, etc.), 
      // keep as-is for runtime but don't expose in LLM schema
      return step;
  }
}

/**
 * Expands fillForm with multiple fields into sequence of fill steps
 */
export function expandFillForm(step: any): RuntimeStep[] {
  if (step.type !== "fillForm" || !step.fields) {
    return [mapToCanonicalStep(step)];
  }
  
  const fillSteps: RuntimeStep[] = step.fields.map((field: any) => ({
    type: "fill" as const,
    target: field.selector,
    value: field.value,
  }));
  
  // Add submit click if requested
  if (step.submit) {
    const submitTarget = step.submitSelector || `${step.formSelector || ''} [type="submit"], ${step.formSelector || ''} button[type="submit"]`.trim();
    fillSteps.push({
      type: "click",
      target: submitTarget || 'button[type="submit"]',
    });
  }
  
  return fillSteps;
}

/**
 * Normalizes all steps in an array, expanding and mapping as needed
 */
export function normalizeStepsArray(steps: any[]): RuntimeStep[] {
  if (!steps || steps.length === 0) return [];
  
  const normalized: RuntimeStep[] = [];
  
  for (const step of steps) {
    if (step.type === "fillForm") {
      normalized.push(...expandFillForm(step));
    } else {
      normalized.push(mapToCanonicalStep(step));
    }
  }
  
  return normalized;
}
