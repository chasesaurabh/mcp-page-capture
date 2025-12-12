import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { 
  LocalStorageTarget, 
  MemoryStorageTarget,
  S3StorageTarget,
  createStorageTarget,
  registerStorageTarget,
  getStorageTarget,
  getDefaultStorageTarget
} from "../../src/storage/index.js";
import type { Logger } from "../../src/logger.js";

describe("storage targets", () => {
  let mockLogger: Logger;
  let tempDir: string;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    tempDir = path.join(process.cwd(), "test-captures-" + Date.now());
  });

  afterEach(async () => {
    // Clean up temp directory if it exists
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  });

  describe("LocalStorageTarget", () => {
    it("should save data to local filesystem", async () => {
      const storage = new LocalStorageTarget(tempDir, mockLogger);
      const data = Buffer.from("test data");
      
      const result = await storage.save(data, {
        filename: "test.txt",
        mimeType: "text/plain",
      });
      
      expect(result.location).toContain("test.txt");
      expect(result.size).toBe(data.length);
      
      // Verify file exists
      const savedData = await fs.readFile(path.join(tempDir, "test.txt"));
      expect(savedData.toString()).toBe("test data");
    });

    it("should generate filename if not provided", async () => {
      const storage = new LocalStorageTarget(tempDir, mockLogger);
      const data = Buffer.from("test data");
      
      const result = await storage.save(data, {
        mimeType: "image/png",
      });
      
      expect(result.location).toContain(".png");
      expect(result.location).toContain("capture-");
    });

    it("should save base64 encoded data", async () => {
      const storage = new LocalStorageTarget(tempDir, mockLogger);
      const originalData = "test data";
      const base64Data = Buffer.from(originalData).toString("base64");
      
      const result = await storage.save(base64Data, {
        filename: "test-base64.txt",
      });
      
      const savedData = await fs.readFile(path.join(tempDir, "test-base64.txt"));
      expect(savedData.toString()).toBe(originalData);
    });

    it("should retrieve saved data", async () => {
      const storage = new LocalStorageTarget(tempDir, mockLogger);
      const data = Buffer.from("retrieve test");
      
      await storage.save(data, { filename: "retrieve.txt" });
      
      const retrieved = await storage.retrieve("retrieve.txt");
      expect(retrieved).toBeInstanceOf(Buffer);
      expect(retrieved?.toString()).toBe("retrieve test");
    });

    it("should return null for non-existent file", async () => {
      const storage = new LocalStorageTarget(tempDir, mockLogger);
      
      const retrieved = await storage.retrieve("non-existent.txt");
      expect(retrieved).toBeNull();
    });

    it("should list stored files", async () => {
      const storage = new LocalStorageTarget(tempDir, mockLogger);
      
      await storage.save(Buffer.from("file1"), { filename: "file1.txt" });
      await storage.save(Buffer.from("file2"), { filename: "file2.txt" });
      
      const list = await storage.list();
      
      expect(list).toHaveLength(2);
      expect(list.map(item => item.key)).toContain("file1.txt");
      expect(list.map(item => item.key)).toContain("file2.txt");
    });

    it("should delete stored file", async () => {
      const storage = new LocalStorageTarget(tempDir, mockLogger);
      
      await storage.save(Buffer.from("to delete"), { filename: "delete.txt" });
      
      const deleted = await storage.delete("delete.txt");
      expect(deleted).toBe(true);
      
      const retrieved = await storage.retrieve("delete.txt");
      expect(retrieved).toBeNull();
    });

    it("should return false when deleting non-existent file", async () => {
      const storage = new LocalStorageTarget(tempDir, mockLogger);
      
      const deleted = await storage.delete("non-existent.txt");
      expect(deleted).toBe(false);
    });

    it("should use correct file extensions", async () => {
      const storage = new LocalStorageTarget(tempDir, mockLogger);
      
      const pngResult = await storage.save(Buffer.from("png"), { mimeType: "image/png" });
      expect(pngResult.location).toContain(".png");
      
      const jpegResult = await storage.save(Buffer.from("jpeg"), { mimeType: "image/jpeg" });
      expect(jpegResult.location).toContain(".jpg");
      
      const htmlResult = await storage.save(Buffer.from("html"), { mimeType: "text/html" });
      expect(htmlResult.location).toContain(".html");
      
      const jsonResult = await storage.save(Buffer.from("json"), { mimeType: "application/json" });
      expect(jsonResult.location).toContain(".json");
    });
  });

  describe("MemoryStorageTarget", () => {
    it("should save data to memory", async () => {
      const storage = new MemoryStorageTarget(mockLogger);
      const data = Buffer.from("memory test");
      
      const result = await storage.save(data, {
        filename: "memory.txt",
      });
      
      expect(result.location).toBe("memory://memory.txt");
      expect(result.size).toBe(data.length);
    });

    it("should retrieve data from memory", async () => {
      const storage = new MemoryStorageTarget(mockLogger);
      const data = Buffer.from("retrieve from memory");
      
      await storage.save(data, { filename: "mem.txt" });
      
      const retrieved = await storage.retrieve("mem.txt");
      expect(retrieved?.toString()).toBe("retrieve from memory");
    });

    it("should list stored items", async () => {
      const storage = new MemoryStorageTarget(mockLogger);
      
      await storage.save(Buffer.from("item1"), { 
        filename: "item1.txt",
        tags: { type: "test" }
      });
      await storage.save(Buffer.from("item2"), { filename: "item2.txt" });
      
      const list = await storage.list();
      
      expect(list).toHaveLength(2);
      expect(list[0].key).toBe("item1.txt");
      expect(list[0].metadata).toEqual({ type: "test" });
    });

    it("should delete items from memory", async () => {
      const storage = new MemoryStorageTarget(mockLogger);
      
      await storage.save(Buffer.from("to delete"), { filename: "delete.txt" });
      
      const deleted = await storage.delete("delete.txt");
      expect(deleted).toBe(true);
      
      const retrieved = await storage.retrieve("delete.txt");
      expect(retrieved).toBeNull();
    });

    it("should generate unique keys when filename not provided", async () => {
      const storage = new MemoryStorageTarget(mockLogger);
      
      const result1 = await storage.save(Buffer.from("data1"), {});
      const result2 = await storage.save(Buffer.from("data2"), {});
      
      expect(result1.location).not.toBe(result2.location);
      expect(result1.location).toContain("memory://");
      expect(result2.location).toContain("memory://");
    });
  });

  describe("S3StorageTarget", () => {
    it("should create mock S3 storage result", async () => {
      const storage = new S3StorageTarget({
        bucket: "test-bucket",
        prefix: "screenshots/",
        region: "us-west-2",
      }, mockLogger);
      
      const data = Buffer.from("s3 test");
      
      const result = await storage.save(data, {
        filename: "test.png",
        mimeType: "image/png",
      });
      
      expect(result.location).toBe("s3://test-bucket/screenshots/test.png");
      expect(result.url).toContain("test-bucket.s3.us-west-2.amazonaws.com");
      expect(result.size).toBe(data.length);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "storage:s3:save",
        expect.objectContaining({
          note: "S3 integration not implemented - using mock response",
        })
      );
    });

    it("should handle prefix configuration", async () => {
      const storage = new S3StorageTarget({
        bucket: "my-bucket",
        prefix: "captures/dom/",
      }, mockLogger);
      
      const result = await storage.save(Buffer.from("data"), {
        filename: "dom.json",
      });
      
      expect(result.location).toBe("s3://my-bucket/captures/dom/dom.json");
    });

    it("should generate filename if not provided", async () => {
      const storage = new S3StorageTarget({
        bucket: "auto-bucket",
      }, mockLogger);
      
      const result = await storage.save(Buffer.from("data"), {
        mimeType: "image/png",
      });
      
      expect(result.location).toContain("s3://auto-bucket/");
      expect(result.location).toContain(".png");
    });
  });

  describe("storage factory", () => {
    it("should create local storage target", () => {
      const storage = createStorageTarget({
        type: "local",
        path: "/custom/path",
      }, mockLogger);
      
      expect(storage).toBeInstanceOf(LocalStorageTarget);
      expect(storage.type).toBe("local");
    });

    it("should create S3 storage target", () => {
      const storage = createStorageTarget({
        type: "s3",
        bucket: "my-bucket",
      }, mockLogger);
      
      expect(storage).toBeInstanceOf(S3StorageTarget);
      expect(storage.type).toBe("s3");
    });

    it("should create memory storage target", () => {
      const storage = createStorageTarget({
        type: "memory",
      }, mockLogger);
      
      expect(storage).toBeInstanceOf(MemoryStorageTarget);
      expect(storage.type).toBe("memory");
    });

    it("should throw for unknown storage type", () => {
      expect(() => createStorageTarget({
        type: "unknown" as any,
      }, mockLogger)).toThrow("Unknown storage type");
    });
  });

  describe("storage registry", () => {
    it("should register and retrieve storage targets", () => {
      const storage = new MemoryStorageTarget(mockLogger);
      
      registerStorageTarget("test-storage", storage);
      
      const retrieved = getStorageTarget("test-storage");
      expect(retrieved).toBe(storage);
    });

    it("should return undefined for unregistered target", () => {
      const retrieved = getStorageTarget("non-existent");
      expect(retrieved).toBeUndefined();
    });

    it("should get or create default storage target", () => {
      const defaultStorage = getDefaultStorageTarget(mockLogger);
      
      expect(defaultStorage).toBeDefined();
      expect(defaultStorage.type).toBe("local");
      
      // Should return same instance on subsequent calls
      const secondCall = getDefaultStorageTarget(mockLogger);
      expect(secondCall).toBe(defaultStorage);
    });
  });
});
