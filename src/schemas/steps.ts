/**
 * Step Schemas - Re-exports from centralized schema
 * @see ./index.ts for the single source of truth
 */

export {
  // Primary step schemas (LLM-exposed)
  viewportStepSchema as viewportStep,
  waitStepSchema as waitStep,
  fillStepSchema as fillStep,
  clickStepSchema as clickStep,
  scrollStepSchema as scrollStep,
  screenshotStepSchema as screenshotStep,
  // Combined schemas
  llmStepSchema as primaryStepSchema,
  runtimeStepSchema as allStepsSchema,
  // Internal/Advanced step schemas
  delayStepSchema as delayStep,
  cookieStepSchema as cookieStep,
  storageStepSchema as storageStep,
  evaluateStepSchema as evaluateStep,
  hoverStepSchema as hoverStep,
  typeStepSchema as typeStep,
  // Types
  type LLMStep as PrimaryStep,
  type RuntimeStep as AnyStep,
  type ViewportStep,
  type WaitStep,
  type FillStep,
  type ClickStep,
  type ScrollStep,
  type ScreenshotStep,
} from "./index.js";

// Additional type exports for internal steps
import type { z } from "zod";
import type {
  delayStepSchema,
  cookieStepSchema,
  storageStepSchema,
  evaluateStepSchema,
  hoverStepSchema,
  typeStepSchema,
} from "./index.js";

export type TypeStep = z.infer<typeof typeStepSchema>;
export type HoverStep = z.infer<typeof hoverStepSchema>;
export type CookieStep = z.infer<typeof cookieStepSchema>;
export type StorageStep = z.infer<typeof storageStepSchema>;
export type DelayStep = z.infer<typeof delayStepSchema>;
export type EvaluateStep = z.infer<typeof evaluateStepSchema>;
