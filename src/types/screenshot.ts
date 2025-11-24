export interface CaptureScreenshotInput {
  url: string;
  fullPage?: boolean;
}

export interface ScreenshotMetadata {
  url: string;
  fullPage: boolean;
  viewportWidth: number;
  viewportHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  bytes: number;
  capturedAt: string;
}

export interface CaptureScreenshotResult {
  metadata: ScreenshotMetadata;
  imageBase64: string;
  mimeType: string;
}
