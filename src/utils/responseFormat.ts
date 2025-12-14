/**
 * Response formatting utilities for LLM-friendly output
 */

import type { ScreenshotMetadata } from "../types/screenshot.js";
import type { ExtractDomResult } from "../types/dom.js";

export interface StepExecutionInfo {
  type: string;
  target?: string;
  success: boolean;
  error?: string;
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format screenshot metadata for LLM-friendly response
 */
export function formatMetadata(metadata: ScreenshotMetadata, stepsInfo?: StepExecutionInfo[]): string {
  const lines = [
    "✓ Screenshot captured successfully",
    "",
    `URL: ${metadata.url}`,
    `Device: ${metadata.viewportPreset || 'desktop'} (${metadata.viewportWidth}x${metadata.viewportHeight})`,
    `Captured: ${metadata.capturedAt}`,
    `Full page: ${metadata.fullPage}`,
    `Size: ${formatBytes(metadata.bytes)}`,
  ];

  if (stepsInfo && stepsInfo.length > 0) {
    lines.push("");
    lines.push(`Steps executed: ${stepsInfo.filter(s => s.success).length}/${stepsInfo.length}`);
    stepsInfo.forEach((step, i) => {
      const status = step.success ? "✓" : "✗";
      const detail = step.target ? ` ${step.target}` : "";
      lines.push(`  ${i + 1}. ${status} ${step.type}${detail}`);
      if (step.error) {
        lines.push(`     Error: ${step.error}`);
      }
    });
  }

  if (metadata.retryAttempts && metadata.retryAttempts > 0) {
    lines.push("");
    lines.push(`Retries: ${metadata.retryAttempts}`);
  }

  return lines.join("\n");
}

/**
 * Format DOM extraction summary for LLM-friendly response
 */
export function formatDomSummary(result: ExtractDomResult): string {
  return [
    "✓ DOM extracted successfully",
    "",
    `URL: ${result.url}`,
    `Selector: ${result.selector || "<entire document>"}`,
    `Nodes: ${result.nodeCount}${result.truncated ? " (truncated at 5000)" : ""}`,
    `HTML size: ${formatBytes(result.html.length)}`,
    `Text size: ${formatBytes(result.text.length)}`,
    "",
    "Content sections below: HTML, Text, DOM Tree",
  ].join("\n");
}
