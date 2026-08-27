export const VARIANT_COUNT = 3;

export function variantSeeds(count = VARIANT_COUNT): number[] {
  const base = Math.floor(Math.random() * 1_000_000_000);
  return Array.from({ length: count }, (_, i) => (base + i * 9973) >>> 0);
}

export async function collectVariantUrls(tasks: Promise<string>[]): Promise<string[]> {
  const settled = await Promise.allSettled(tasks);
  const urls: string[] = [];
  let firstError: unknown;
  for (const result of settled) {
    if (result.status === "fulfilled" && result.value) {
      urls.push(result.value);
    } else if (result.status === "rejected" && firstError === undefined) {
      firstError = result.reason;
    }
  }
  if (urls.length === 0) {
    throw firstError instanceof Error
      ? firstError
      : new Error("画像生成に失敗しました。しばらくしてから再試行してください。");
  }
  return urls;
}

export function outputsFromResponse(data: {
  output?: string;
  outputs?: string[];
}): string[] {
  if (data.outputs && data.outputs.length > 0) return data.outputs;
  return data.output ? [data.output] : [];
}
