import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import fs from "node:fs/promises";

async function captureScreenshot(url: string, fullPage = false) {
  const client = new Client({
    name: "pagecapture-cli",
    version: "1.0.0",
  });

  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/cli.js"],
    stderr: "pipe",
  });

  try {
    await client.connect(transport);

    const result = await client.callTool({
      name: "captureScreenshot",
      arguments: { url, fullPage },
    });

    const content = Array.isArray((result as any).content)
      ? ((result as any).content as ToolContent[])
      : [];

    const textContent = content.find(isTextContent);
    const imageContent = content.find(isImageContent);

    if (!imageContent || imageContent.type !== "image") {
      throw new Error("captureScreenshot did not return an image payload");
    }

    const outDir = path.resolve("captures");
    await fs.mkdir(outDir, { recursive: true });

    const fileName = sanitizeFilename(url) + (fullPage ? "-full" : "") + ".png";
    const outPath = path.join(outDir, fileName);

    await fs.writeFile(outPath, Buffer.from(imageContent.data, "base64"));

    if (textContent && textContent.type === "text") {
      console.log(textContent.text);
    }

    console.log(`Screenshot saved to ${outPath}`);
  } finally {
    await transport.close();
  }
}

type ToolContent = TextContent | ImageContent | Record<string, unknown>;
type TextContent = { type: "text"; text: string };
type ImageContent = { type: "image"; data: string; mimeType?: string };

function isTextContent(entry: ToolContent): entry is TextContent {
  return entry.type === "text" && typeof (entry as Partial<TextContent>).text === "string";
}

function isImageContent(entry: ToolContent): entry is ImageContent {
  return entry.type === "image" && typeof (entry as Partial<ImageContent>).data === "string";
}

function sanitizeFilename(url: string): string {
  return url.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

const targetUrl = process.argv[2] ?? "http://localhost:5173";
const fullPage = process.argv.includes("--full-page");

captureScreenshot(targetUrl, fullPage).catch((error) => {
  console.error("Capture failed:", error);
  process.exitCode = 1;
});
