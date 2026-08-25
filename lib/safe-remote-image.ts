import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// base64 JSON化後も一般的なServerless応答上限内に収める
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function isPrivateIp(address: string): boolean {
  if (address === "::1" || address === "0.0.0.0") return true;
  if (address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) {
    return true;
  }
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

async function assertPublicUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("HTTP(S)画像のみ取り込めます");
  }
  if (url.username || url.password) throw new Error("認証情報付きURLは使用できません");

  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true });
  if (addresses.length === 0 || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new Error("安全でない画像URLです");
  }
  return url;
}

export async function fetchPublicImage(rawUrl: string): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  let current = rawUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const url = await assertPublicUrl(current);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "AI-Render-Material-Importer/1.0" },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) {
        throw new Error("画像URLのリダイレクトが多すぎます");
      }
      current = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) throw new Error("画像を取得できませんでした");

    const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "";
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      throw new Error("対応していない画像形式です");
    }
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_IMAGE_BYTES) throw new Error("画像サイズが大きすぎます");

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) throw new Error("画像サイズが大きすぎます");
    return { buffer: Buffer.from(arrayBuffer), mimeType };
  }
  throw new Error("画像を取得できませんでした");
}
