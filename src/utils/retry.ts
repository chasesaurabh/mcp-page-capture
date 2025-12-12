import type { Logger } from "../logger.js";

export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
  retryableErrors: string[];
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatusCodes: [500, 502, 503, 504, 408, 429],
  retryableErrors: ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "ECONNREFUSED", "EAI_AGAIN"],
};

export interface RetryContext {
  attempt: number;
  totalAttempts: number;
  lastError?: Error;
  lastStatusCode?: number;
}

function isRetryableError(error: Error, policy: RetryPolicy): boolean {
  const message = error.message.toLowerCase();
  
  // Check for DNS errors
  if (message.includes("dns") || message.includes("getaddrinfo")) {
    return true;
  }
  
  // Check for timeout errors
  if (message.includes("timeout") || message.includes("timed out")) {
    return true;
  }
  
  // Check for network errors
  if (message.includes("network") || message.includes("connection")) {
    return true;
  }
  
  // Check specific error codes
  return policy.retryableErrors.some(code => 
    message.includes(code.toLowerCase()) || error.message.includes(code)
  );
}

function isRetryableStatusCode(statusCode: number | undefined, policy: RetryPolicy): boolean {
  if (!statusCode) return false;
  return policy.retryableStatusCodes.includes(statusCode);
}

function calculateDelay(attempt: number, policy: RetryPolicy): number {
  const delay = Math.min(
    policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1),
    policy.maxDelayMs
  );
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay;
  return Math.floor(delay + jitter);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    policy?: Partial<RetryPolicy>;
    logger?: Logger;
    context?: string;
  } = {}
): Promise<T> {
  const policy: RetryPolicy = {
    ...DEFAULT_RETRY_POLICY,
    ...options.policy,
  };
  
  let lastError: Error | undefined;
  let lastStatusCode: number | undefined;
  
  for (let attempt = 1; attempt <= policy.maxRetries + 1; attempt++) {
    try {
      if (attempt > 1) {
        const delay = calculateDelay(attempt - 1, policy);
        options.logger?.info(`${options.context || 'retry'}:waiting`, {
          attempt,
          delay,
          reason: lastError?.message || `status ${lastStatusCode}`,
        });
        await sleep(delay);
      }
      
      const result = await fn();
      
      if (attempt > 1) {
        options.logger?.info(`${options.context || 'retry'}:succeeded`, {
          attempt,
          totalAttempts: attempt,
        });
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      // Extract status code if available
      const statusMatch = lastError.message.match(/status:\s*(\d+)/);
      if (statusMatch) {
        lastStatusCode = parseInt(statusMatch[1], 10);
      }
      
      const isLastAttempt = attempt === policy.maxRetries + 1;
      const isRetryable = isRetryableError(lastError, policy) || 
                         isRetryableStatusCode(lastStatusCode, policy);
      
      if (isLastAttempt || !isRetryable) {
        options.logger?.error(`${options.context || 'retry'}:failed`, {
          attempt,
          totalAttempts: attempt,
          error: lastError.message,
          statusCode: lastStatusCode,
          retryable: isRetryable,
        });
        throw lastError;
      }
      
      options.logger?.warn(`${options.context || 'retry'}:attempt_failed`, {
        attempt,
        error: lastError.message,
        statusCode: lastStatusCode,
        willRetry: true,
      });
    }
  }
  
  // This should never be reached due to the throw in the catch block
  throw lastError || new Error("Retry failed with unknown error");
}

export function createRetryableFunction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  defaultOptions: {
    policy?: Partial<RetryPolicy>;
    logger?: Logger;
    context?: string;
  } = {}
): T {
  return (async (...args: Parameters<T>) => {
    return withRetry(() => fn(...args), defaultOptions);
  }) as T;
}
