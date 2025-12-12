import { EventEmitter } from "events";
import type { Logger } from "../logger.js";

export type TelemetryEventType = 
  | "tool.invoked"
  | "tool.completed"
  | "tool.failed"
  | "navigation.started"
  | "navigation.completed"
  | "navigation.failed"
  | "retry.attempt"
  | "retry.succeeded"
  | "retry.failed"
  | "screenshot.captured"
  | "scroll.executed"
  | "dom.extracted"
  | "browser.launched"
  | "browser.closed";

export interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface TelemetryHook {
  name: string;
  enabled: boolean;
  handler: (event: TelemetryEvent) => void | Promise<void>;
}

export interface HttpSinkConfig {
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  batchSize?: number;
  flushIntervalMs?: number;
}

export interface WebhookSinkConfig extends HttpSinkConfig {
  secret?: string;
  signatureHeader?: string;
}

export class TelemetryEmitter extends EventEmitter {
  private hooks: Map<string, TelemetryHook> = new Map();
  private logger?: Logger;
  private eventBuffer: TelemetryEvent[] = [];
  private httpSink?: HttpSinkConfig;
  private flushTimer?: NodeJS.Timeout;

  constructor(logger?: Logger) {
    super();
    this.logger = logger;
  }

  registerHook(hook: TelemetryHook): void {
    this.hooks.set(hook.name, hook);
    this.logger?.debug("telemetry:hook_registered", { name: hook.name });
  }

  unregisterHook(name: string): void {
    this.hooks.delete(name);
    this.logger?.debug("telemetry:hook_unregistered", { name });
  }

  enableHook(name: string): void {
    const hook = this.hooks.get(name);
    if (hook) {
      hook.enabled = true;
      this.logger?.debug("telemetry:hook_enabled", { name });
    }
  }

  disableHook(name: string): void {
    const hook = this.hooks.get(name);
    if (hook) {
      hook.enabled = false;
      this.logger?.debug("telemetry:hook_disabled", { name });
    }
  }

  async emitTelemetry(type: TelemetryEventType, data: Record<string, any>, metadata?: Record<string, any>): Promise<void> {
    const event: TelemetryEvent = {
      type,
      timestamp: new Date().toISOString(),
      data,
      metadata,
    };

    // Emit to all enabled hooks
    const enabledHooks = Array.from(this.hooks.values()).filter(h => h.enabled);
    
    for (const hook of enabledHooks) {
      try {
        await Promise.resolve(hook.handler(event));
      } catch (error) {
        this.logger?.error("telemetry:hook_error", {
          hook: hook.name,
          error: (error as Error).message,
        });
      }
    }

    // Buffer event for HTTP sink if configured
    if (this.httpSink) {
      this.bufferEvent(event);
    }

    // Emit as standard event for compatibility
    super.emit(type, event);
  }

  configureHttpSink(config: HttpSinkConfig): void {
    this.httpSink = config;
    
    // Set up flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    if (config.flushIntervalMs) {
      this.flushTimer = setInterval(() => {
        this.flushEvents().catch(error => {
          this.logger?.error("telemetry:flush_error", { error: error.message });
        });
      }, config.flushIntervalMs);
    }

    this.logger?.info("telemetry:http_sink_configured", { 
      url: config.url,
      batchSize: config.batchSize,
      flushInterval: config.flushIntervalMs,
    });
  }

  private bufferEvent(event: TelemetryEvent): void {
    this.eventBuffer.push(event);
    
    const batchSize = this.httpSink?.batchSize || 100;
    if (this.eventBuffer.length >= batchSize) {
      this.flushEvents().catch(error => {
        this.logger?.error("telemetry:auto_flush_error", { error: error.message });
      });
    }
  }

  async flushEvents(): Promise<void> {
    if (!this.httpSink || this.eventBuffer.length === 0) {
      return;
    }

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      const response = await fetch(this.httpSink.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.httpSink.headers,
        },
        body: JSON.stringify({ events }),
        signal: AbortSignal.timeout(this.httpSink.timeout || 10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.logger?.debug("telemetry:events_flushed", { count: events.length });
    } catch (error) {
      this.logger?.error("telemetry:flush_failed", { 
        error: (error as Error).message,
        eventCount: events.length,
      });
      
      // Re-buffer events on failure (with limit to prevent memory issues)
      const maxBuffer = 1000;
      if (this.eventBuffer.length < maxBuffer) {
        this.eventBuffer.unshift(...events.slice(0, maxBuffer - this.eventBuffer.length));
      }
      
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    
    // Final flush
    if (this.eventBuffer.length > 0) {
      try {
        await this.flushEvents();
      } catch (error) {
        this.logger?.error("telemetry:shutdown_flush_error", { 
          error: (error as Error).message,
        });
      }
    }
  }
}

// Global singleton instance
let globalTelemetry: TelemetryEmitter | undefined;

export function getGlobalTelemetry(logger?: Logger): TelemetryEmitter {
  if (!globalTelemetry) {
    globalTelemetry = new TelemetryEmitter(logger);
  }
  return globalTelemetry;
}

// Helper function to create webhook signature
export function createWebhookSignature(payload: string, secret: string): string {
  const crypto = require("crypto");
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

// Built-in hooks

export function createConsoleHook(): TelemetryHook {
  return {
    name: "console",
    enabled: false,
    handler: (event) => {
      console.log("[TELEMETRY]", JSON.stringify(event, null, 2));
    },
  };
}

export function createMetricsHook(): TelemetryHook {
  const metrics: Record<string, number> = {};
  
  return {
    name: "metrics",
    enabled: false,
    handler: (event) => {
      const key = `${event.type}_count`;
      metrics[key] = (metrics[key] || 0) + 1;
      
      // Track durations if available
      if (event.data.duration) {
        const durationKey = `${event.type}_duration_ms`;
        const current = metrics[durationKey] || 0;
        metrics[durationKey] = current + event.data.duration;
      }
    },
  };
}

export function createWebhookHook(config: WebhookSinkConfig): TelemetryHook {
  return {
    name: "webhook",
    enabled: false,
    handler: async (event) => {
      const payload = JSON.stringify(event);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...config.headers,
      };
      
      if (config.secret && config.signatureHeader) {
        headers[config.signatureHeader] = createWebhookSignature(payload, config.secret);
      }
      
      const response = await fetch(config.url, {
        method: "POST",
        headers,
        body: payload,
        signal: AbortSignal.timeout(config.timeout || 10000),
      });
      
      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }
    },
  };
}
