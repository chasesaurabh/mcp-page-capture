import type { CaptureCookieInput } from "./screenshot.js";

export type DomNode =
  | {
      type: "element";
      tagName: string;
      attributes: Record<string, string>;
      children: DomNode[];
    }
  | {
      type: "text";
      textContent: string;
    };

export interface ExtractDomInput {
  url: string;
  selector?: string;
  headers?: Record<string, string>;
  cookies?: CaptureCookieInput[];
}

export interface ExtractDomResult {
  url: string;
  selector?: string;
  html: string;
  text: string;
  domTree: DomNode;
  nodeCount: number;
  truncated: boolean;
  capturedAt: string;
}
