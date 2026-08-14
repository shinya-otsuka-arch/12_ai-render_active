/** Replicate の多様な出力形式から最終画像 URL を1つ取り出す */
export function extractOutputUrl(output: unknown): string {
  if (typeof output === "string") return output;

  if (Array.isArray(output) && output.length > 0) {
    // fofr Multi-ControlNet は先頭に control プレビューを含むため末尾を採用
    const last = output[output.length - 1];
    if (typeof last === "string") return last;
    if (last && typeof last === "object" && "url" in last) {
      const url = (last as { url: unknown }).url;
      return typeof url === "function" ? String(url()) : String(url);
    }
    return String(last);
  }

  if (output && typeof output === "object" && "url" in output) {
    const url = (output as { url: unknown }).url;
    return typeof url === "function" ? String(url()) : String(url);
  }

  return String(output);
}
