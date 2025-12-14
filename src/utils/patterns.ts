/**
 * Composite Pattern Expansion Utilities
 * 
 * Expands high-level patterns (login, search) into atomic steps
 * for simplified LLM interaction while maintaining runtime compatibility.
 */

import type { LoginPattern, SearchPattern, LLMStep } from "../schemas/index.js";

/**
 * Expands a login pattern into atomic steps
 */
export function expandLoginPattern(pattern: LoginPattern): LLMStep[] {
  return [
    { type: "fill", target: pattern.email.selector, value: pattern.email.value },
    { type: "fill", target: pattern.password.selector, value: pattern.password.value },
    { type: "click", target: pattern.submit, waitFor: pattern.successIndicator },
  ];
}

/**
 * Expands a search pattern into atomic steps
 */
export function expandSearchPattern(pattern: SearchPattern): LLMStep[] {
  const steps: LLMStep[] = [
    { 
      type: "fill", 
      target: pattern.input, 
      value: pattern.query,
      submit: pattern.submit !== false, // default true
    },
    { type: "wait", for: pattern.resultsIndicator },
  ];
  return steps;
}

/**
 * Check if a step is a composite pattern
 */
export function isCompositePattern(step: any): step is LoginPattern | SearchPattern {
  return step.type === "login" || step.type === "search";
}

/**
 * Expand all composite patterns in a steps array
 * Returns a new array with patterns replaced by their atomic steps
 */
export function expandPatterns(steps: any[]): LLMStep[] {
  const expanded: LLMStep[] = [];
  
  for (const step of steps) {
    if (step.type === "login") {
      expanded.push(...expandLoginPattern(step as LoginPattern));
    } else if (step.type === "search") {
      expanded.push(...expandSearchPattern(step as SearchPattern));
    } else {
      expanded.push(step as LLMStep);
    }
  }
  
  return expanded;
}

/**
 * Get pattern description for error messages
 */
export function getPatternDescription(type: string): string {
  switch (type) {
    case "login":
      return "Login pattern expands to: fill email → fill password → click submit → wait for success";
    case "search":
      return "Search pattern expands to: fill search input → wait for results";
    default:
      return "";
  }
}
