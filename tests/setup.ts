import { promises as fs } from "fs";
import path from "path";

const PROJECT_ROOT = process.cwd();

/**
 * Patterns for test-generated files that should be cleaned up
 */
const TEST_FILE_PATTERNS = [
  /^test-captures-\d+$/,        // test-captures-* directories
  /^capture-.*\.(png|jpg|html|json)$/,  // capture-*.png, .jpg, .html, .json files
];

/**
 * Cleans up test-generated files and directories from the project root
 */
async function cleanupTestFiles(): Promise<void> {
  try {
    const entries = await fs.readdir(PROJECT_ROOT, { withFileTypes: true });
    
    for (const entry of entries) {
      const shouldClean = TEST_FILE_PATTERNS.some(pattern => pattern.test(entry.name));
      
      if (shouldClean) {
        const fullPath = path.join(PROJECT_ROOT, entry.name);
        try {
          if (entry.isDirectory()) {
            await fs.rm(fullPath, { recursive: true, force: true });
          } else {
            await fs.unlink(fullPath);
          }
        } catch {
          // Ignore errors for individual files
        }
      }
    }
  } catch {
    // Ignore errors reading directory
  }
}

/**
 * Global setup - runs once before all tests
 */
export async function setup(): Promise<void> {
  await cleanupTestFiles();
}

/**
 * Global teardown - runs once after all tests
 */
export async function teardown(): Promise<void> {
  await cleanupTestFiles();
}
