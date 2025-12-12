import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Logger } from "../logger.js";

export interface StorageTarget {
  type: string;
  save(data: Buffer | string, metadata: StorageMetadata): Promise<StorageResult>;
  retrieve?(key: string): Promise<Buffer | string | null>;
  list?(): Promise<StorageListItem[]>;
  delete?(key: string): Promise<boolean>;
}

export interface StorageMetadata {
  filename?: string;
  mimeType?: string;
  contentType?: string;
  timestamp?: string;
  tags?: Record<string, string>;
}

export interface StorageResult {
  location: string;
  url?: string;
  size: number;
  metadata?: Record<string, any>;
}

export interface StorageListItem {
  key: string;
  size: number;
  modified: string;
  metadata?: Record<string, any>;
}

export class LocalStorageTarget implements StorageTarget {
  type = "local";
  private baseDir: string;
  private logger?: Logger;

  constructor(baseDir?: string, logger?: Logger) {
    this.baseDir = baseDir || path.join(process.cwd(), "captures");
    this.logger = logger;
  }

  async save(data: Buffer | string, metadata: StorageMetadata): Promise<StorageResult> {
    // Ensure directory exists
    await fs.mkdir(this.baseDir, { recursive: true });

    // Generate filename if not provided
    const filename = metadata.filename || this.generateFilename(metadata);
    const filePath = path.join(this.baseDir, filename);

    // Convert string to Buffer if needed
    const buffer = typeof data === "string" ? Buffer.from(data, "base64") : data;

    // Write file
    await fs.writeFile(filePath, buffer);

    this.logger?.debug("storage:local:saved", { 
      path: filePath, 
      size: buffer.length 
    });

    return {
      location: filePath,
      size: buffer.length,
      metadata: {
        filename,
        timestamp: metadata.timestamp || new Date().toISOString(),
        ...metadata.tags,
      },
    };
  }

  async retrieve(key: string): Promise<Buffer | null> {
    try {
      const filePath = path.join(this.baseDir, key);
      const data = await fs.readFile(filePath);
      this.logger?.debug("storage:local:retrieved", { path: filePath });
      return data;
    } catch (error) {
      if ((error as any).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async list(): Promise<StorageListItem[]> {
    try {
      const files = await fs.readdir(this.baseDir);
      const items: StorageListItem[] = [];

      for (const file of files) {
        const filePath = path.join(this.baseDir, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isFile()) {
          items.push({
            key: file,
            size: stat.size,
            modified: stat.mtime.toISOString(),
          });
        }
      }

      return items;
    } catch (error) {
      if ((error as any).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.baseDir, key);
      await fs.unlink(filePath);
      this.logger?.debug("storage:local:deleted", { path: filePath });
      return true;
    } catch (error) {
      if ((error as any).code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }

  private generateFilename(metadata: StorageMetadata): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const extension = this.getExtension(metadata.mimeType);
    return `capture-${timestamp}${extension}`;
  }

  private getExtension(mimeType?: string): string {
    switch (mimeType) {
      case "image/png":
        return ".png";
      case "image/jpeg":
        return ".jpg";
      case "text/html":
        return ".html";
      case "application/json":
        return ".json";
      default:
        return ".bin";
    }
  }
}

export class S3StorageTarget implements StorageTarget {
  type = "s3";
  private bucket: string;
  private prefix: string;
  private region: string;
  private logger?: Logger;

  constructor(config: { 
    bucket: string; 
    prefix?: string; 
    region?: string;
  }, logger?: Logger) {
    this.bucket = config.bucket;
    this.prefix = config.prefix || "";
    this.region = config.region || "us-east-1";
    this.logger = logger;
  }

  async save(data: Buffer | string, metadata: StorageMetadata): Promise<StorageResult> {
    // This is a placeholder implementation
    // In production, you would use AWS SDK or S3-compatible client
    
    const key = this.prefix + (metadata.filename || this.generateKey(metadata));
    const buffer = typeof data === "string" ? Buffer.from(data, "base64") : data;

    this.logger?.info("storage:s3:save", {
      bucket: this.bucket,
      key,
      size: buffer.length,
      note: "S3 integration not implemented - using mock response",
    });

    // Mock response
    return {
      location: `s3://${this.bucket}/${key}`,
      url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`,
      size: buffer.length,
      metadata: {
        bucket: this.bucket,
        key,
        ...metadata.tags,
      },
    };
  }

  private generateKey(metadata: StorageMetadata): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const extension = this.getExtension(metadata.mimeType);
    return `capture-${timestamp}${extension}`;
  }

  private getExtension(mimeType?: string): string {
    switch (mimeType) {
      case "image/png":
        return ".png";
      case "image/jpeg":
        return ".jpg";
      case "text/html":
        return ".html";
      case "application/json":
        return ".json";
      default:
        return ".bin";
    }
  }
}

export class MemoryStorageTarget implements StorageTarget {
  type = "memory";
  private storage: Map<string, Buffer> = new Map();
  private metadata: Map<string, StorageMetadata> = new Map();
  private logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  async save(data: Buffer | string, metadata: StorageMetadata): Promise<StorageResult> {
    const key = metadata.filename || this.generateKey(metadata);
    const buffer = typeof data === "string" ? Buffer.from(data, "base64") : data;
    
    this.storage.set(key, buffer);
    this.metadata.set(key, metadata);

    this.logger?.debug("storage:memory:saved", { 
      key, 
      size: buffer.length 
    });

    return {
      location: `memory://${key}`,
      size: buffer.length,
      metadata: {
        ...metadata.tags,
        timestamp: metadata.timestamp || new Date().toISOString(),
      },
    };
  }

  async retrieve(key: string): Promise<Buffer | null> {
    return this.storage.get(key) || null;
  }

  async list(): Promise<StorageListItem[]> {
    const items: StorageListItem[] = [];
    
    for (const [key, buffer] of this.storage.entries()) {
      const meta = this.metadata.get(key);
      items.push({
        key,
        size: buffer.length,
        modified: meta?.timestamp || new Date().toISOString(),
        metadata: meta?.tags,
      });
    }

    return items;
  }

  async delete(key: string): Promise<boolean> {
    const existed = this.storage.has(key);
    this.storage.delete(key);
    this.metadata.delete(key);
    return existed;
  }

  private generateKey(metadata: StorageMetadata): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }
}

// Storage factory and registry

export type StorageTargetConfig = 
  | { type: "local"; path?: string }
  | { type: "s3"; bucket: string; prefix?: string; region?: string }
  | { type: "memory" };

const storageRegistry = new Map<string, StorageTarget>();

export function createStorageTarget(config: StorageTargetConfig, logger?: Logger): StorageTarget {
  switch (config.type) {
    case "local":
      return new LocalStorageTarget(config.path, logger);
    case "s3":
      return new S3StorageTarget(config, logger);
    case "memory":
      return new MemoryStorageTarget(logger);
    default:
      throw new Error(`Unknown storage type: ${(config as any).type}`);
  }
}

export function registerStorageTarget(name: string, target: StorageTarget): void {
  storageRegistry.set(name, target);
}

export function getStorageTarget(name: string): StorageTarget | undefined {
  return storageRegistry.get(name);
}

export function getDefaultStorageTarget(logger?: Logger): StorageTarget {
  const defaultTarget = storageRegistry.get("default");
  if (defaultTarget) {
    return defaultTarget;
  }
  
  // Create and register a default local storage target
  const localTarget = new LocalStorageTarget(undefined, logger);
  registerStorageTarget("default", localTarget);
  return localTarget;
}
