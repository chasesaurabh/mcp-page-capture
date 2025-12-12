/**
 * Timeout utilities for preventing operations from hanging indefinitely.
 */

export class TimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve within
 * the specified time, the timeout rejects with a TimeoutError.
 * 
 * IMPORTANT: This does NOT cancel the underlying operation - it only
 * stops waiting for it. The caller is responsible for cleanup.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string = "Operation"
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new TimeoutError(`${operationName} timed out after ${timeoutMs}ms`, timeoutMs));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Safely closes a browser with a timeout to prevent hanging.
 * If the close operation times out, we log a warning but don't throw.
 * The browser process may still be running but we can't wait forever.
 */
export async function safeBrowserClose(
  browser: { close: () => Promise<void> },
  timeoutMs: number = 5000,
  logger?: { warn: (msg: string, meta?: Record<string, unknown>) => void }
): Promise<void> {
  try {
    await withTimeout(browser.close(), timeoutMs, "Browser close");
  } catch (error) {
    if (error instanceof TimeoutError) {
      logger?.warn("browser:close_timeout", {
        timeoutMs,
        message: "Browser close timed out, process may still be running",
      });
    } else {
      logger?.warn("browser:close_error", {
        error: (error as Error).message,
      });
    }
  }
}
