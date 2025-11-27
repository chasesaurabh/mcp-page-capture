export function normalizeUrl(input: string): string {
  try {
    const parsed = new URL(input);
    return parsed.toString();
  } catch {
    const parsed = new URL(`https://${input}`);
    return parsed.toString();
  }
}
