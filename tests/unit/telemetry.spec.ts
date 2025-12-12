import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TelemetryEmitter,
  getGlobalTelemetry,
  createConsoleHook,
  createMetricsHook,
  createWebhookHook,
  createWebhookSignature,
  type TelemetryHook,
  type TelemetryEvent,
} from "../../src/telemetry/index.js";
import type { Logger } from "../../src/logger.js";

describe("telemetry", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    vi.clearAllMocks();
  });

  describe("TelemetryEmitter", () => {
    it("should create an emitter instance", () => {
      const emitter = new TelemetryEmitter(mockLogger);
      expect(emitter).toBeInstanceOf(TelemetryEmitter);
    });

    it("should emit telemetry events", async () => {
      const emitter = new TelemetryEmitter(mockLogger);
      const eventListener = vi.fn();
      
      emitter.on("tool.invoked", eventListener);
      
      await emitter.emitTelemetry("tool.invoked", { tool: "captureScreenshot" });
      
      expect(eventListener).toHaveBeenCalledTimes(1);
      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "tool.invoked",
          data: { tool: "captureScreenshot" },
        })
      );
    });

    it("should include timestamp in events", async () => {
      const emitter = new TelemetryEmitter(mockLogger);
      const eventListener = vi.fn();
      
      emitter.on("tool.completed", eventListener);
      
      await emitter.emitTelemetry("tool.completed", { tool: "extractDom" });
      
      const event = eventListener.mock.calls[0][0] as TelemetryEvent;
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("should include metadata when provided", async () => {
      const emitter = new TelemetryEmitter(mockLogger);
      const eventListener = vi.fn();
      
      emitter.on("navigation.started", eventListener);
      
      await emitter.emitTelemetry(
        "navigation.started", 
        { url: "https://example.com" },
        { requestId: "abc123" }
      );
      
      const event = eventListener.mock.calls[0][0] as TelemetryEvent;
      expect(event.metadata).toEqual({ requestId: "abc123" });
    });
  });

  describe("hooks", () => {
    it("should register and call enabled hooks", async () => {
      const emitter = new TelemetryEmitter(mockLogger);
      const handler = vi.fn();
      
      const hook: TelemetryHook = {
        name: "test-hook",
        enabled: true,
        handler,
      };
      
      emitter.registerHook(hook);
      await emitter.emitTelemetry("tool.invoked", { test: true });
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "telemetry:hook_registered",
        { name: "test-hook" }
      );
    });

    it("should not call disabled hooks", async () => {
      const emitter = new TelemetryEmitter(mockLogger);
      const handler = vi.fn();
      
      const hook: TelemetryHook = {
        name: "disabled-hook",
        enabled: false,
        handler,
      };
      
      emitter.registerHook(hook);
      await emitter.emitTelemetry("tool.invoked", { test: true });
      
      expect(handler).not.toHaveBeenCalled();
    });

    it("should enable and disable hooks", async () => {
      const emitter = new TelemetryEmitter(mockLogger);
      const handler = vi.fn();
      
      const hook: TelemetryHook = {
        name: "toggle-hook",
        enabled: false,
        handler,
      };
      
      emitter.registerHook(hook);
      
      // Initially disabled
      await emitter.emitTelemetry("tool.invoked", {});
      expect(handler).not.toHaveBeenCalled();
      
      // Enable it
      emitter.enableHook("toggle-hook");
      await emitter.emitTelemetry("tool.invoked", {});
      expect(handler).toHaveBeenCalledTimes(1);
      
      // Disable it
      emitter.disableHook("toggle-hook");
      await emitter.emitTelemetry("tool.invoked", {});
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should unregister hooks", async () => {
      const emitter = new TelemetryEmitter(mockLogger);
      const handler = vi.fn();
      
      emitter.registerHook({
        name: "removable-hook",
        enabled: true,
        handler,
      });
      
      await emitter.emitTelemetry("tool.invoked", {});
      expect(handler).toHaveBeenCalledTimes(1);
      
      emitter.unregisterHook("removable-hook");
      
      await emitter.emitTelemetry("tool.invoked", {});
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it("should handle hook errors gracefully", async () => {
      const emitter = new TelemetryEmitter(mockLogger);
      
      const errorHook: TelemetryHook = {
        name: "error-hook",
        enabled: true,
        handler: () => {
          throw new Error("Hook error");
        },
      };
      
      const goodHook: TelemetryHook = {
        name: "good-hook",
        enabled: true,
        handler: vi.fn(),
      };
      
      emitter.registerHook(errorHook);
      emitter.registerHook(goodHook);
      
      // Should not throw
      await emitter.emitTelemetry("tool.invoked", {});
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        "telemetry:hook_error",
        expect.objectContaining({
          hook: "error-hook",
          error: "Hook error",
        })
      );
      expect(goodHook.handler).toHaveBeenCalled();
    });

    it("should handle async hook handlers", async () => {
      const emitter = new TelemetryEmitter(mockLogger);
      const results: number[] = [];
      
      const asyncHook: TelemetryHook = {
        name: "async-hook",
        enabled: true,
        handler: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          results.push(1);
        },
      };
      
      emitter.registerHook(asyncHook);
      await emitter.emitTelemetry("tool.invoked", {});
      
      expect(results).toEqual([1]);
    });
  });

  describe("HTTP sink", () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(null, { status: 200 })
      );
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it("should configure HTTP sink", () => {
      const emitter = new TelemetryEmitter(mockLogger);
      
      emitter.configureHttpSink({
        url: "https://telemetry.example.com/events",
        batchSize: 50,
        flushIntervalMs: 5000,
      });
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        "telemetry:http_sink_configured",
        expect.objectContaining({
          url: "https://telemetry.example.com/events",
          batchSize: 50,
          flushInterval: 5000,
        })
      );
    });

    it("should buffer events when HTTP sink is configured", async () => {
      const emitter = new TelemetryEmitter(mockLogger);
      
      emitter.configureHttpSink({
        url: "https://telemetry.example.com/events",
        batchSize: 100,
      });
      
      await emitter.emitTelemetry("tool.invoked", { tool: "test" });
      
      // Event should be buffered, not sent yet
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should flush events when batch size is reached", async () => {
      const emitter = new TelemetryEmitter(mockLogger);
      
      emitter.configureHttpSink({
        url: "https://telemetry.example.com/events",
        batchSize: 2,
      });
      
      await emitter.emitTelemetry("tool.invoked", { tool: "test1" });
      expect(fetchSpy).not.toHaveBeenCalled();
      
      await emitter.emitTelemetry("tool.invoked", { tool: "test2" });
      
      // Should have triggered a flush
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://telemetry.example.com/events",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should manually flush events", async () => {
      const emitter = new TelemetryEmitter(mockLogger);
      
      emitter.configureHttpSink({
        url: "https://telemetry.example.com/events",
        batchSize: 100,
      });
      
      await emitter.emitTelemetry("tool.invoked", { tool: "test" });
      
      await emitter.flushEvents();
      
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("should not flush when buffer is empty", async () => {
      const emitter = new TelemetryEmitter(mockLogger);
      
      emitter.configureHttpSink({
        url: "https://telemetry.example.com/events",
      });
      
      await emitter.flushEvents();
      
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should handle flush errors", async () => {
      fetchSpy.mockRejectedValue(new Error("Network error"));
      
      const emitter = new TelemetryEmitter(mockLogger);
      
      emitter.configureHttpSink({
        url: "https://telemetry.example.com/events",
        batchSize: 1,
      });
      
      await emitter.emitTelemetry("tool.invoked", { tool: "test" });
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        "telemetry:flush_failed",
        expect.objectContaining({ error: "Network error" })
      );
    });

    it("should include custom headers in flush request", async () => {
      const emitter = new TelemetryEmitter(mockLogger);
      
      emitter.configureHttpSink({
        url: "https://telemetry.example.com/events",
        headers: {
          "Authorization": "Bearer token123",
          "X-Custom": "value",
        },
        batchSize: 1,
      });
      
      await emitter.emitTelemetry("tool.invoked", { tool: "test" });
      
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Authorization": "Bearer token123",
            "X-Custom": "value",
          }),
        })
      );
    });

    it("should shutdown and flush remaining events", async () => {
      const emitter = new TelemetryEmitter(mockLogger);
      
      emitter.configureHttpSink({
        url: "https://telemetry.example.com/events",
        batchSize: 100,
        flushIntervalMs: 60000,
      });
      
      await emitter.emitTelemetry("tool.invoked", { tool: "test" });
      
      await emitter.shutdown();
      
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("built-in hooks", () => {
    describe("createConsoleHook", () => {
      it("should create a console hook that is disabled by default", () => {
        const hook = createConsoleHook();
        
        expect(hook.name).toBe("console");
        expect(hook.enabled).toBe(false);
      });

      it("should log events to console when enabled", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        
        const hook = createConsoleHook();
        hook.enabled = true;
        
        const event: TelemetryEvent = {
          type: "tool.invoked",
          timestamp: new Date().toISOString(),
          data: { tool: "test" },
        };
        
        hook.handler(event);
        
        expect(consoleSpy).toHaveBeenCalledWith(
          "[TELEMETRY]",
          expect.stringContaining("tool.invoked")
        );
        
        consoleSpy.mockRestore();
      });
    });

    describe("createMetricsHook", () => {
      it("should create a metrics hook that is disabled by default", () => {
        const hook = createMetricsHook();
        
        expect(hook.name).toBe("metrics");
        expect(hook.enabled).toBe(false);
      });

      it("should track event counts", () => {
        const hook = createMetricsHook();
        hook.enabled = true;
        
        const event: TelemetryEvent = {
          type: "tool.invoked",
          timestamp: new Date().toISOString(),
          data: {},
        };
        
        // Handler should not throw
        expect(() => hook.handler(event)).not.toThrow();
      });

      it("should track durations when available", () => {
        const hook = createMetricsHook();
        hook.enabled = true;
        
        const event: TelemetryEvent = {
          type: "tool.completed",
          timestamp: new Date().toISOString(),
          data: { duration: 150 },
        };
        
        expect(() => hook.handler(event)).not.toThrow();
      });
    });

    describe("createWebhookHook", () => {
      let fetchSpy: ReturnType<typeof vi.spyOn>;

      beforeEach(() => {
        fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
          new Response(null, { status: 200 })
        );
      });

      afterEach(() => {
        fetchSpy.mockRestore();
      });

      it("should create a webhook hook that is disabled by default", () => {
        const hook = createWebhookHook({
          url: "https://webhook.example.com/events",
        });
        
        expect(hook.name).toBe("webhook");
        expect(hook.enabled).toBe(false);
      });

      it("should send events to webhook URL", async () => {
        const hook = createWebhookHook({
          url: "https://webhook.example.com/events",
        });
        hook.enabled = true;
        
        const event: TelemetryEvent = {
          type: "tool.completed",
          timestamp: new Date().toISOString(),
          data: { tool: "test" },
        };
        
        await hook.handler(event);
        
        expect(fetchSpy).toHaveBeenCalledWith(
          "https://webhook.example.com/events",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
            }),
          })
        );
      });

      it("should include signature header when secret is configured", async () => {
        const hook = createWebhookHook({
          url: "https://webhook.example.com/events",
          secret: "my-secret",
          signatureHeader: "X-Webhook-Signature",
        });
        hook.enabled = true;
        
        const event: TelemetryEvent = {
          type: "tool.completed",
          timestamp: new Date().toISOString(),
          data: {},
        };
        
        await hook.handler(event);
        
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              "X-Webhook-Signature": expect.any(String),
            }),
          })
        );
      });

      it("should include custom headers", async () => {
        const hook = createWebhookHook({
          url: "https://webhook.example.com/events",
          headers: {
            "X-API-Key": "api-key-123",
          },
        });
        hook.enabled = true;
        
        const event: TelemetryEvent = {
          type: "tool.invoked",
          timestamp: new Date().toISOString(),
          data: {},
        };
        
        await hook.handler(event);
        
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              "X-API-Key": "api-key-123",
            }),
          })
        );
      });

      it("should throw on webhook failure", async () => {
        fetchSpy.mockResolvedValue(
          new Response(null, { status: 500, statusText: "Internal Server Error" })
        );
        
        const hook = createWebhookHook({
          url: "https://webhook.example.com/events",
        });
        hook.enabled = true;
        
        const event: TelemetryEvent = {
          type: "tool.failed",
          timestamp: new Date().toISOString(),
          data: {},
        };
        
        await expect(hook.handler(event)).rejects.toThrow("Webhook failed: 500");
      });
    });
  });

  describe("createWebhookSignature", () => {
    it("should create HMAC-SHA256 signature", () => {
      const payload = '{"type":"test"}';
      const secret = "my-secret-key";
      
      const signature = createWebhookSignature(payload, secret);
      
      expect(signature).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
    });

    it("should produce different signatures for different payloads", () => {
      const secret = "shared-secret";
      
      const sig1 = createWebhookSignature('{"a":1}', secret);
      const sig2 = createWebhookSignature('{"a":2}', secret);
      
      expect(sig1).not.toBe(sig2);
    });

    it("should produce different signatures for different secrets", () => {
      const payload = '{"data":"test"}';
      
      const sig1 = createWebhookSignature(payload, "secret1");
      const sig2 = createWebhookSignature(payload, "secret2");
      
      expect(sig1).not.toBe(sig2);
    });
  });

  describe("getGlobalTelemetry", () => {
    it("should return a TelemetryEmitter instance", () => {
      const telemetry = getGlobalTelemetry(mockLogger);
      expect(telemetry).toBeInstanceOf(TelemetryEmitter);
    });

    it("should return the same instance on subsequent calls", () => {
      const telemetry1 = getGlobalTelemetry(mockLogger);
      const telemetry2 = getGlobalTelemetry(mockLogger);
      
      expect(telemetry1).toBe(telemetry2);
    });
  });
});
