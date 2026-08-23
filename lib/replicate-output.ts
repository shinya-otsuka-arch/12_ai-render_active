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

/** 外部 URL を data URL に変換する（canvas の CORS 汚染を避ける） */
export async function toDataUrlIfRemote(src: string): Promise<string> {
  if (!src || src.startsWith("data:")) return src;
  const res = await fetch(src);
  if (!res.ok) {
    throw new Error("生成画像の取得に失敗しました");
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = (res.headers.get("content-type") ?? "image/png").split(";")[0];
  return `data:${mime || "image/png"};base64,${buf.toString("base64")}`;
}
