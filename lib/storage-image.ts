import { resizeDataUrl } from "@/lib/resize-image";

const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

export async function toResizedJpegDataUrl(
  src: string,
  maxEdge: number
): Promise<string> {
  let dataUrl = src;
  if (src.startsWith("http://") || src.startsWith("https://")) {
    const res = await fetch(src);
    if (!res.ok) throw new Error("画像の取得に失敗しました");
    const blob = await res.blob();
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
      reader.readAsDataURL(blob);
    });
  }
  return resizeDataUrl(dataUrl, maxEdge, 0.85);
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("不正な data URL です");
  }
  const mime = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function signedUrl(
  supabase: {
    storage: {
      from: (bucket: string) => {
        createSignedUrl: (
          path: string,
          expiresIn: number
        ) => Promise<{ data: { signedUrl: string } | null; error: unknown }>;
      };
    };
  },
  bucket: string,
  path: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) {
    throw new Error("署名付き URL の取得に失敗しました");
  }
  return data.signedUrl;
}

export { SIGNED_URL_TTL };
