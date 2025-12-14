export interface LLMErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    step?: number;
    stepType?: string;
    target?: string;
  };
  recovery: {
    action: "retry" | "modify" | "skip" | "abort";
    description: string;
    correctedSteps?: object[];
  };
  context: {
    url: string;
    stepsTotal: number;
    stepsCompleted: number;
    lastSuccessfulStep?: number;
    executionTimeMs: number;
  };
}

export interface ErrorDetails {
  message: string;
  step?: number;
  stepType?: string;
  target?: string;
  url: string;
  stepsTotal: number;
  stepsCompleted: number;
  lastSuccessfulStep?: number;
  executionTimeMs: number;
  originalParams?: any;
}

/**
 * Error codes for LLM comprehension
 */
export const ERROR_CODES = {
  ELEMENT_NOT_FOUND: "ELEMENT_NOT_FOUND",
  ELEMENT_NOT_VISIBLE: "ELEMENT_NOT_VISIBLE",
  ELEMENT_NOT_CLICKABLE: "ELEMENT_NOT_CLICKABLE",
  NAVIGATION_TIMEOUT: "NAVIGATION_TIMEOUT",
  NAVIGATION_FAILED: "NAVIGATION_FAILED",
  INVALID_SELECTOR: "INVALID_SELECTOR",
  INVALID_URL: "INVALID_URL",
  STEP_TIMEOUT: "STEP_TIMEOUT",
  FILL_FAILED: "FILL_FAILED",
  SCROLL_FAILED: "SCROLL_FAILED",
} as const;

/**
 * Creates structured error response for LLMs
 */
export function createLLMError(
  code: keyof typeof ERROR_CODES,
  details: {
    message: string;
    step?: number;
    stepType?: string;
    target?: string;
    url?: string;
    stepsTotal?: number;
    stepsCompleted?: number;
    lastSuccessfulStep?: number;
    executionTimeMs?: number;
  }
): LLMErrorResponse {
  const fixes = getFixForError(code, details);
  
  return {
    success: false,
    error: {
      code: ERROR_CODES[code],
      message: details.message,
      step: details.step,
      stepType: details.stepType,
      target: details.target,
    },
    recovery: {
      action: "modify",
      description: fixes.description,
      correctedSteps: Array.isArray(fixes.example) ? fixes.example : ((fixes.example as any).steps || undefined),
    },
    context: {
      url: details.url || "",
      stepsTotal: details.stepsTotal || 0,
      stepsCompleted: details.stepsCompleted || 0,
      lastSuccessfulStep: details.lastSuccessfulStep,
      executionTimeMs: details.executionTimeMs || 0,
    },
  };
}

/**
 * Recovery-focused error responses with corrected steps
 */
export const RECOVERABLE_ERRORS = {
  ELEMENT_NOT_FOUND: (details: ErrorDetails): LLMErrorResponse => ({
    success: false,
    error: {
      code: "ELEMENT_NOT_FOUND",
      message: `Element "${details.target}" not found on page`,
      step: details.step,
      stepType: details.stepType,
      target: details.target,
    },
    recovery: {
      action: "modify",
      description: "Add a wait step before this action, or verify the selector exists",
      correctedSteps: [
        { type: "wait", for: details.target, timeout: 10000 },
        { type: details.stepType, target: details.target, ...details.originalParams },
      ],
    },
    context: {
      url: details.url,
      stepsTotal: details.stepsTotal,
      stepsCompleted: details.stepsCompleted,
      lastSuccessfulStep: details.lastSuccessfulStep,
      executionTimeMs: details.executionTimeMs,
    },
  }),

  ELEMENT_NOT_VISIBLE: (details: ErrorDetails): LLMErrorResponse => ({
    success: false,
    error: {
      code: "ELEMENT_NOT_VISIBLE",
      message: `Element "${details.target}" exists but is not visible`,
      step: details.step,
      stepType: details.stepType,
      target: details.target,
    },
    recovery: {
      action: "modify",
      description: "Scroll to the element before interacting",
      correctedSteps: [
        { type: "scroll", to: details.target },
        { type: "wait", for: details.target, timeout: 2000 },
        { type: details.stepType, target: details.target, ...details.originalParams },
      ],
    },
    context: {
      url: details.url,
      stepsTotal: details.stepsTotal,
      stepsCompleted: details.stepsCompleted,
      lastSuccessfulStep: details.lastSuccessfulStep,
      executionTimeMs: details.executionTimeMs,
    },
  }),

  NAVIGATION_TIMEOUT: (details: ErrorDetails): LLMErrorResponse => ({
    success: false,
    error: {
      code: "NAVIGATION_TIMEOUT",
      message: `Page "${details.url}" did not load within timeout`,
    },
    recovery: {
      action: "retry",
      description: "The page may be slow. Retry or check if URL is accessible.",
    },
    context: {
      url: details.url,
      stepsTotal: details.stepsTotal,
      stepsCompleted: 0,
      lastSuccessfulStep: undefined,
      executionTimeMs: details.executionTimeMs,
    },
  }),

  INVALID_SELECTOR: (details: ErrorDetails): LLMErrorResponse => ({
    success: false,
    error: {
      code: "INVALID_SELECTOR",
      message: `Invalid CSS selector: "${details.target}"`,
      step: details.step,
      stepType: details.stepType,
      target: details.target,
    },
    recovery: {
      action: "modify",
      description: "Fix the selector syntax",
      correctedSteps: undefined,
    },
    context: {
      url: details.url,
      stepsTotal: details.stepsTotal,
      stepsCompleted: details.stepsCompleted,
      lastSuccessfulStep: details.lastSuccessfulStep,
      executionTimeMs: details.executionTimeMs,
    },
  }),
};

function getFixForError(code: keyof typeof ERROR_CODES, details: any): { description: string; example: object } {
  switch (code) {
    case "ELEMENT_NOT_FOUND":
      return {
        description: `Element "${details.target}" not found. Add a wait step before this action, or verify the selector.`,
        example: {
          steps: [
            { type: "wait", for: details.target },
            { type: details.stepType, target: details.target },
          ],
        },
      };
      
    case "ELEMENT_NOT_VISIBLE":
      return {
        description: `Element "${details.target}" exists but is not visible. Scroll to it first.`,
        example: {
          steps: [
            { type: "scroll", to: details.target },
            { type: "wait", duration: 500 },
            { type: details.stepType, target: details.target },
          ],
        },
      };
      
    case "ELEMENT_NOT_CLICKABLE":
      return {
        description: `Element "${details.target}" is covered by another element. Try scrolling or waiting.`,
        example: {
          steps: [
            { type: "scroll", to: details.target },
            { type: "wait", duration: 300 },
            { type: "click", target: details.target },
          ],
        },
      };
      
    case "NAVIGATION_TIMEOUT":
      return {
        description: `Page took too long to load. The URL may be slow or unreachable.`,
        example: {
          url: details.url,
        },
      };
      
    case "INVALID_SELECTOR":
      return {
        description: `Invalid CSS selector "${details.target}". Check syntax.`,
        example: {
          valid_selectors: [
            "#id - Select by ID",
            ".class - Select by class",
            "button - Select by tag",
            "[data-test='value'] - Select by attribute",
            ".parent .child - Select nested element",
          ],
        },
      };
      
    case "FILL_FAILED":
      return {
        description: `Could not fill "${details.target}". Element may be disabled, readonly, or wrong type.`,
        example: {
          steps: [
            { type: "wait", for: details.target },
            { type: "click", target: details.target },
            { type: "fill", target: details.target, value: "your-value" },
          ],
        },
      };
      
    default:
      return {
        description: details.message,
        example: {},
      };
  }
}

/**
 * Formats error for MCP tool response with recovery information
 */
export function formatErrorForMCP(error: LLMErrorResponse): string {
  const lines = [
    `❌ ${error.error.code}: ${error.error.message}`,
    "",
    `RECOVERY: ${error.recovery.description}`,
  ];
  
  if (error.recovery.correctedSteps) {
    lines.push("");
    lines.push("CORRECTED STEPS:");
    lines.push("```json");
    lines.push(JSON.stringify(error.recovery.correctedSteps, null, 2));
    lines.push("```");
  }
  
  if (error.context) {
    lines.push("");
    lines.push(`Context: ${error.context.stepsCompleted}/${error.context.stepsTotal} steps completed, last success: step ${error.context.lastSuccessfulStep ?? 'none'}`);
    lines.push(`Execution time: ${error.context.executionTimeMs}ms`);
  }
  
  return lines.join("\n");
}

// Legacy exports for backward compatibility
export const LLM_ERRORS = {
  ELEMENT_NOT_FOUND: (selector: string, step: string) => ({
    message: `✗ ${step} failed: Element not found`,
    fix: `The selector "${selector}" matched no elements. Check if:
1. The selector is correct (inspect page HTML)
2. The element loads dynamically (add a 'wait' step before)
3. The element is inside an iframe (not supported)`,
    example: {
      type: "wait",
      for: selector,
    },
  }),

  NAVIGATION_TIMEOUT: (url: string) => ({
    message: `✗ Navigation failed: Page took too long to load`,
    fix: `The page "${url}" didn't finish loading in 45 seconds. Try:
1. Check if URL is correct and accessible
2. The page may have slow resources - add retry or wait`,
    example: {
      url: url,
      waitFor: "body",
    },
  }),

  CLICK_NOT_VISIBLE: (selector: string) => ({
    message: `✗ click failed: Element not visible or clickable`,
    fix: `The element "${selector}" exists but can't be clicked. Try:
1. Scroll to the element first
2. Wait for it to become visible
3. Check if another element is covering it`,
    example: [
      { type: "scroll", to: selector },
      { type: "wait", for: selector },
      { type: "click", target: selector },
    ],
  }),

  INVALID_SELECTOR: (selector: string) => ({
    message: `✗ Invalid CSS selector: "${selector}"`,
    fix: `The selector syntax is invalid. Common issues:
1. Missing # for ID selectors: "#email" not "email"
2. Missing . for class selectors: ".btn" not "btn"
3. Unescaped special characters`,
    example: null,
  }),

  WAIT_MISSING_CONDITION: () => ({
    message: `✗ wait step needs 'for' (selector) or 'duration' (ms)`,
    fix: `Specify what to wait for:
- Use 'for' with a CSS selector when waiting for an element (preferred)
- Use 'duration' with milliseconds for a fixed delay`,
    example: [
      { type: "wait", for: ".content-loaded" },
      { type: "wait", duration: 2000 },
    ],
  }),

  FILL_MISSING_VALUE: (target: string) => ({
    message: `✗ fill step needs 'target' and 'value'`,
    fix: `The fill step for "${target}" is missing required parameters:
- 'target': CSS selector for the input field
- 'value': The value to enter`,
    example: {
      type: "fill",
      target: "#email",
      value: "user@example.com",
    },
  }),
};

export interface LLMError {
  message: string;
  fix: string;
  example: any;
}

export function formatErrorResponse(error: LLMError): string {
  const content = [
    error.message,
    "",
    `FIX: ${error.fix}`,
  ];

  if (error.example) {
    content.push("");
    content.push(`EXAMPLE:`);
    content.push("```json");
    content.push(JSON.stringify(error.example, null, 2));
    content.push("```");
  }

  return content.join("\n");
}
