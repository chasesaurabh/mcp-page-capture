/**
 * LLM Step Schemas - Re-exports from centralized schema
 * @see ./index.ts for the single source of truth
 */

export {
  // 6 Primary LLM-exposed step schemas
  viewportStepSchema,
  waitStepSchema,
  fillStepSchema,
  clickStepSchema,
  scrollStepSchema,
  screenshotStepSchema,
  // Combined LLM schema
  llmStepSchema,
  // Types
  type LLMStep,
  type ViewportStep,
  type WaitStep,
  type FillStep,
  type ClickStep,
  type ScrollStep,
  type ScreenshotStep,
} from "./index.js";
