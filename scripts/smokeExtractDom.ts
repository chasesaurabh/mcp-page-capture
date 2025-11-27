import { createLogger } from "../src/logger.js";
import { runDomExtraction } from "../src/tools/extractDom.js";

async function main() {
  const [url, selector] = process.argv.slice(2);
  if (!url) {
    console.error("Usage: tsx scripts/smokeExtractDom.ts <url> [selector]");
    process.exitCode = 1;
    return;
  }

  const logger = createLogger("info");

  try {
    const result = await runDomExtraction({ url, selector }, logger);
    console.log(
      JSON.stringify(
        {
          url: result.url,
          selector: result.selector ?? null,
          nodeCount: result.nodeCount,
          truncated: result.truncated,
          htmlLength: result.html.length,
          textLength: result.text.length,
          capturedAt: result.capturedAt,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error("extractDom smoke test failed", error);
    process.exitCode = 1;
  }
}

void main();
