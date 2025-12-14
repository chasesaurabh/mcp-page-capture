/**
 * Step execution utilities for handling both simplified and legacy step types
 */

import type { Page } from "puppeteer";
import type { Logger } from "../logger.js";
import type {
  ActionStep,
  FillStep,
  SimpleClickStep,
  SimpleScrollStep,
  WaitStep,
  SimpleScreenshotStep,
  SimpleViewportStep,
  TypeStep,
  SimpleHoverStep,
  ClickStep,
  ScrollStep,
  WaitForSelectorStep,
  ScreenshotStep,
  ViewportStep,
  HoverStep
} from "../types/screenshot.js";
import { LLM_ERRORS, formatErrorResponse } from "./errors.js";
import { validateSelector } from "./normalize.js";

/**
 * Execute a click step (handles both SimpleClickStep and ClickStep)
 */
export async function executeClickStep(
  page: Page,
  step: SimpleClickStep | ClickStep,
  logger?: Logger
): Promise<void> {
  // Validate selector
  const validation = validateSelector(step.target);
  if (!validation.valid) {
    throw new Error(formatErrorResponse(LLM_ERRORS.INVALID_SELECTOR(step.target)));
  }

  // Wait for the element to be present
  try {
    await page.waitForSelector(step.target, { timeout: 10000 });
  } catch (e) {
    throw new Error(formatErrorResponse(LLM_ERRORS.ELEMENT_NOT_FOUND(step.target, "click")));
  }

  // Handle SimpleClickStep
  if ('waitAfter' in step) {
    await page.click(step.target);
    
    if (step.waitAfter) {
      logger?.debug("step:click:waitingAfter", { waitAfter: step.waitAfter });
      try {
        await page.waitForSelector(step.waitAfter, { timeout: 10000 });
      } catch (e) {
        logger?.warn("step:click:waitAfter_timeout", { waitAfter: step.waitAfter });
      }
    }
  } 
  // Handle legacy ClickStep
  else {
    const clickStep = step as ClickStep;
    const clickOptions: { button?: "left" | "right" | "middle"; clickCount?: number } = {};
    
    if (clickStep.button) {
      clickOptions.button = clickStep.button;
    }
    if (clickStep.clickCount) {
      clickOptions.clickCount = clickStep.clickCount;
    }

    if (clickStep.waitForNavigation) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
        page.click(step.target, clickOptions),
      ]);
    } else {
      await page.click(step.target, clickOptions);
    }

    if (clickStep.waitForSelector) {
      logger?.debug("step:click:waitingForSelector", { waitForSelector: clickStep.waitForSelector });
      try {
        await page.waitForSelector(clickStep.waitForSelector, { timeout: 10000 });
      } catch (e) {
        logger?.warn("step:click:waitForSelector_timeout", { waitForSelector: clickStep.waitForSelector });
      }
    }
  }
}

/**
 * Execute a scroll step (handles both SimpleScrollStep and ScrollStep)
 */
export async function executeScrollStep(
  page: Page,
  step: SimpleScrollStep | ScrollStep,
  logger?: Logger
): Promise<void> {
  // Handle SimpleScrollStep
  if ('to' in step && step.to) {
    const validation = validateSelector(step.to);
    if (!validation.valid) {
      throw new Error(formatErrorResponse(LLM_ERRORS.INVALID_SELECTOR(step.to)));
    }

    const scrollResult = await page.evaluate(
      (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) {
          return { ok: false, error: `Element not found: ${selector}` };
        }
        element.scrollIntoView({ behavior: "auto", block: "start" });
        return { ok: true, x: window.scrollX, y: window.scrollY };
      },
      step.to
    );

    if (!scrollResult.ok) {
      throw new Error(formatErrorResponse(LLM_ERRORS.ELEMENT_NOT_FOUND(step.to, "scroll")));
    }
  }
  // Handle y position or legacy ScrollStep
  else if ('y' in step && step.y !== undefined) {
    await page.evaluate(
      (y: number) => {
        window.scrollTo({ left: 0, top: y, behavior: "auto" });
      },
      step.y
    );
  }
  // Handle legacy ScrollStep with scrollTo
  else if ('scrollTo' in step && step.scrollTo) {
    const scrollStep = step as ScrollStep;
    const behavior = scrollStep.behavior || "auto";
    const scrollTo = scrollStep.scrollTo!; // We know it exists from the condition above
    
    const scrollResult = await page.evaluate(
      (params: { scrollTo: string; behavior: ScrollBehavior }) => {
        const element = document.querySelector(params.scrollTo);
        if (!element) {
          return { ok: false, error: `Element not found: ${params.scrollTo}` } as const;
        }
        element.scrollIntoView({ behavior: params.behavior, block: "start" });
        return { ok: true, x: window.scrollX, y: window.scrollY } as const;
      },
      { scrollTo, behavior }
    );

    if (!scrollResult.ok) {
      throw new Error(formatErrorResponse(LLM_ERRORS.ELEMENT_NOT_FOUND(scrollTo, "scroll")));
    }

    // Wait for smooth scroll
    if (behavior === "smooth") {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  // Handle legacy x/y position
  else if ('x' in step || 'y' in step) {
    const scrollStep = step as ScrollStep;
    const x = scrollStep.x ?? 0;
    const y = scrollStep.y ?? 0;
    const behavior = scrollStep.behavior || "auto";
    
    await page.evaluate(
      (params: { x: number; y: number; behavior: ScrollBehavior }) => {
        window.scrollTo({ left: params.x, top: params.y, behavior: params.behavior });
      },
      { x, y, behavior }
    );

    if (behavior === "smooth") {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

/**
 * Execute a wait step (handles both WaitStep and WaitForSelectorStep)
 */
export async function executeWaitStep(
  page: Page,
  step: WaitStep | WaitForSelectorStep,
  logger?: Logger
): Promise<void> {
  // Handle new WaitStep
  if ('for' in step && step.for) {
    const validation = validateSelector(step.for);
    if (!validation.valid) {
      throw new Error(formatErrorResponse(LLM_ERRORS.INVALID_SELECTOR(step.for)));
    }

    try {
      await page.waitForSelector(step.for, { timeout: 10000 });
    } catch (e) {
      throw new Error(formatErrorResponse(LLM_ERRORS.ELEMENT_NOT_FOUND(step.for, "wait")));
    }
  }
  // Handle duration
  else if ('duration' in step && step.duration !== undefined) {
    await new Promise(resolve => setTimeout(resolve, step.duration));
  }
  // Handle legacy WaitForSelectorStep
  else if ('awaitElement' in step) {
    const waitStep = step as WaitForSelectorStep;
    const timeout = waitStep.timeout ?? 10000;
    
    try {
      await page.waitForSelector(waitStep.awaitElement, { timeout });
    } catch (e) {
      throw new Error(formatErrorResponse(LLM_ERRORS.ELEMENT_NOT_FOUND(waitStep.awaitElement, "waitForSelector")));
    }
  }
  else {
    throw new Error(formatErrorResponse(LLM_ERRORS.WAIT_MISSING_CONDITION()));
  }
}

/**
 * Execute a screenshot step (handles both SimpleScreenshotStep and ScreenshotStep)
 */
export async function executeScreenshotStep(
  page: Page,
  step: SimpleScreenshotStep | ScreenshotStep,
  fullPageEnabled: boolean,
  logger?: Logger
): Promise<Buffer> {
  const useFullPage = step.fullPage !== undefined ? step.fullPage : fullPageEnabled;
  
  // Handle element capture
  const elementSelector = 'element' in step ? step.element : 
                         'captureElement' in step ? (step as ScreenshotStep).captureElement : 
                         undefined;

  if (elementSelector) {
    const validation = validateSelector(elementSelector);
    if (!validation.valid) {
      throw new Error(formatErrorResponse(LLM_ERRORS.INVALID_SELECTOR(elementSelector)));
    }

    const element = await page.$(elementSelector);
    if (element) {
      return (await element.screenshot({ type: "png" })) as Buffer;
    } else {
      logger?.warn("step:screenshot:element_not_found", { element: elementSelector });
      // Fall back to page screenshot
    }
  }

  return (await page.screenshot({
    type: "png",
    fullPage: useFullPage,
  })) as Buffer;
}

/**
 * Execute a hover step (handles both SimpleHoverStep and HoverStep)
 */
export async function executeHoverStep(
  page: Page,
  step: SimpleHoverStep | HoverStep,
  logger?: Logger
): Promise<void> {
  // Get the selector (target for new, selector for legacy)
  const selector = 'target' in step ? step.target : step.selector;
  
  if (!selector) {
    throw new Error(formatErrorResponse(LLM_ERRORS.ELEMENT_NOT_FOUND("undefined", "hover")));
  }
  
  const validation = validateSelector(selector);
  if (!validation.valid) {
    throw new Error(formatErrorResponse(LLM_ERRORS.INVALID_SELECTOR(selector)));
  }

  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.hover(selector);
    
    const duration = step.duration ?? 100;
    if (duration > 0) {
      await new Promise(resolve => setTimeout(resolve, duration));
    }
  } catch (e) {
    throw new Error(formatErrorResponse(LLM_ERRORS.ELEMENT_NOT_FOUND(selector, "hover")));
  }
}

/**
 * Execute a type step
 */
export async function executeTypeStep(
  page: Page,
  step: TypeStep,
  logger?: Logger
): Promise<void> {
  const validation = validateSelector(step.target);
  if (!validation.valid) {
    throw new Error(formatErrorResponse(LLM_ERRORS.INVALID_SELECTOR(step.target)));
  }

  try {
    await page.waitForSelector(step.target, { timeout: 5000 });
    await page.click(step.target);
    
    // Type with optional delay
    if (step.delay && step.delay > 0) {
      await page.type(step.target, step.text, { delay: step.delay });
    } else {
      await page.type(step.target, step.text);
    }
    
    if (step.pressEnter) {
      await page.keyboard.press('Enter');
    }
  } catch (e) {
    throw new Error(formatErrorResponse(LLM_ERRORS.ELEMENT_NOT_FOUND(step.target, "type")));
  }
}

/**
 * Execute a fill step
 */
export async function executeFillStep(
  page: Page,
  step: FillStep,
  logger?: Logger
): Promise<void> {
  // Handle single field
  if (step.target && step.value !== undefined) {
    const validation = validateSelector(step.target);
    if (!validation.valid) {
      throw new Error(formatErrorResponse(LLM_ERRORS.INVALID_SELECTOR(step.target)));
    }

    try {
      await page.waitForSelector(step.target, { timeout: 5000 });
      
      // Determine field type
      const fieldType = await page.evaluate((selector: string) => {
        const el = document.querySelector(selector) as HTMLElement;
        if (!el) return null;
        
        if (el instanceof HTMLSelectElement) return 'select';
        if (el instanceof HTMLInputElement) {
          if (el.type === 'checkbox') return 'checkbox';
          if (el.type === 'radio') return 'radio';
          return 'text';
        }
        if (el instanceof HTMLTextAreaElement) return 'textarea';
        return 'text';
      }, step.target);

      if (!fieldType) {
        throw new Error(formatErrorResponse(LLM_ERRORS.ELEMENT_NOT_FOUND(step.target, "fill")));
      }

      // Fill based on type
      switch (fieldType) {
        case 'checkbox':
          const shouldCheck = step.value === 'true';
          await page.evaluate((selector: string, check: boolean) => {
            const el = document.querySelector(selector) as HTMLInputElement;
            if (el && el.checked !== check) el.click();
          }, step.target, shouldCheck);
          break;
          
        case 'radio':
          await page.click(step.target);
          break;
          
        case 'select':
          await page.select(step.target, step.value);
          break;
          
        default:
          if (step.clear !== false) {
            await page.click(step.target, { clickCount: 3 });
            await page.keyboard.press('Backspace');
          }
          await page.type(step.target, step.value);
      }
    } catch (e) {
      throw new Error(formatErrorResponse(LLM_ERRORS.ELEMENT_NOT_FOUND(step.target, "fill")));
    }
  }
  // Handle multiple fields
  else if (step.fields && step.fields.length > 0) {
    for (const field of step.fields) {
      await executeFillStep(page, {
        type: "fill",
        target: field.target,
        value: field.value,
        clear: step.clear
      }, logger);
    }
  }
  else {
    throw new Error(formatErrorResponse(LLM_ERRORS.FILL_MISSING_VALUE("")));
  }

  // Handle submit
  if (step.submit) {
    await page.keyboard.press('Enter');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
